const path = require('path');
const fs = require('fs');
const {
    yellow
} = require('colors');
const { 
    table,
    getBorderCharacters
} = require('table');

const { log } = console;

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

    let d = getDateAndTime().date;
    let fileName = `${d}.json`;
    let pathToStatsFile = path.join(pathToStatsDir, fileName);
    let stats = (fs.existsSync(pathToStatsFile)) ? readJson(pathToStatsFile) : {};

    for (const topic of topicsStats) {
        if (!topic) continue;

        const { topicId, name, views, date, time } = topic;

        if (!topicId || !name || !views || !date || !time) continue;

        if (date !== d) {
            saveJson(pathToStatsFile, stats, '\t');

            d = date;
            fileName = `${d}.json`;
            pathToStatsFile = path.join(pathToStatsDir, fileName);
            stats = (fs.existsSync(pathToStatsFile)) ? readJson(pathToStatsFile) : {};
        }

        if (topicId in stats) {
            const topicStats = stats[topicId];
            const lately = views - topicStats.total;
    
            topicStats.total  = views;
            topicStats.perday += lately;
            topicStats.lately = lately;

            topicStats.times.push({
                time, 
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
                        time, 
                        views: 0
                    }
                ]
            }
        }
    }

    saveJson(pathToStatsFile, stats, '\t');
}

const getStats = (date, pathToStatsDir) => {        
    if (date) {
        if (!pathToStatsDir) {
            pathToStatsDir = date;
            date = null;
        }
    } else {
        if (!pathToStatsDir) {
            throw Error('path not specified');
        }
    }

    if (fs.existsSync(pathToStatsDir)) {
        
        date = date ? getDateAndTime(date).date : getDateAndTime().date;
        const fileName  = `${date}.json`;
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
    const yesterdayStats = date ? getStats(date - 86400000, pathToStatsDir) : getStats(Date.now() - 86400000, pathToStatsDir);
    const stats = [];

    if (todayStats) {
        for (const topic in todayStats) {
            stats.push([
                topic,
                todayStats[topic].name || '',
                todayStats[topic].lately || 0,
                todayStats[topic].perday || 0,
                (yesterdayStats && (topic in yesterdayStats)) ? yesterdayStats[topic].perday : 0,
                todayStats[topic].total || 0,
            ]);
        }
    }

    log(table([
        ['topic'.bold, 'name'.bold, 'lately'.bold, 'today'.bold, 'yesterday'.bold, 'total'.bold],
        ...stats.sort((a, b) => b[3] - a[3]).map(row => [
            yellow(row[0]), 
            row[1],
            yellow(row[2]), 
            yellow(row[3]), 
            yellow(row[4]), 
            yellow(row[5]), 
        ])
    ], {
        border: getBorderCharacters('norc'),
        drawHorizontalLine: (index, size) => {
            return index === 0 || index === 1 || index === size;
        }
    }));
}


module.exports = {
    addStats,
    getStats,
    printStats
};