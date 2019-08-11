const path = require('path');
const fs = require('fs');

const {
    getDateAndTime
} = require('./helpers/time');

const {
    readJson,
    saveJson
} = require('./helpers/common');

const addStats = (topicsStats, pathToStatsDir) => {
    if (!Array.isArray(topicsStats)) throw Error('topicsStats must be an array');
    if (!pathToStatsDir) throw Error('path not specified');

    if (!fs.existsSync(pathToStatsDir)) {
        fs.mkdirSync(pathToStatsDir);
    }

    const d = getDateAndTime();
    const fileName = `${d.date}.json`;
    const pathToStatsFile = path.join(pathToStatsDir, fileName);

    let stats = (fs.existsSync(pathToStatsFile)) ? readJson(pathToStatsFile) : {};

    for (const topic of topicsStats) {
        if (!topic) continue;

        const { topic: topicId, name, views } = topic;

        if (!topicId && !name && !views) continue;

        if (topicId in stats) {
            const topicStats = stats[topicId];
            const lately = views - topicStats.total;
    
            topicStats.total  = views;
            topicStats.perday += lately;
            topicStats.lately = lately;

            topicStats.times.push({
                time: d.time, 
                views: lately
            });
        } else {
            stats[topicId] = {
                name,
                total: views,
                perday: 0,
                lately: 0,
                times: [
                    {
                        time: d.time, 
                        views: 0
                    }
                ]
            }
        }
    }

    saveJson(pathToStatsFile, stats, '\t');
}

const getStats = (date, pathToStatsDir) => {    
    if (fs.existsSync(pathToStatsDir)) {
        const d = date || getDateAndTime().date;
        const fileName  = `${d}.json`;
        const pathToStatsFile  = path.join(pathToStatsDir, fileName);
    
        if (fs.existsSync(pathToStatsFile)) {
            return readJson(pathToStatsFile);
        }
    }
    
    return null;
}

const printStats = (date, pathToStatsDir) => {
    if (date) {
        if (!pathToStatsDir) {
            pathToStatsDir = date;
            date = null;    
        }
    } else {
        throw Error('path not specified');
    }

    const todayStats = getStats(date, pathToStatsDir);
    const yesterdayStats = date ? null : getStats(Date.now() - 86400000);
    const stats = [];

    if (todayStats) {
        for (const topic in todayStats) {
            stats.push({
                name: todayStats[topic].name || '',
                lately: todayStats[topic].lately|| 0,
                today: todayStats[topic].perday || 0,
                yesterday: (yesterdayStats && (topic in yesterdayStats)) ? yesterdayStats[topic].perday : 0,
                total: todayStats[topic].total || 0,
            });
        }
    }

    console.table(stats.sort((a, b) => b.today - a.today));
}


module.exports = {
    addStats,
    getStats,
    printStats
};