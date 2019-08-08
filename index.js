const cheerio   = require('cheerio');
const fs        = require('fs');
const logUp     = require('log-update');
const path      = require('path');
const colors    = require('colors');
const request   = require('request-promise').defaults({
    jar: true, 
    encoding: null, 
    simple: false, 
    transform: (body) => {
        return cheerio.load(normalizeBodyEncode(body), { decodeEntities: false })
    }
});

const {
    readJson,
    saveJson,
    fileToArr,
    normalizeBodyEncode,
    normalizeFormEntries,
    removeSmiles,
} = require('./helpers/common');

const {
    delay,
    getTime,
    getDate,
    timer,
    timeDiff,
    minToMs
} = require('./helpers/time');

const { log } = console;

const {
    login: LOGIN, 
    topic: TOPIC, 
    settings: SETTINGS
}   = require('./config.json');

const signIn = () => {
    return request.post({
        uri: LOGIN.url,
        form: LOGIN.form
    })
    .then($ => {
        if ($.text()) {
            const err = $('#frmLogin > table > tbody > tr:nth-child(2)').text().trim();

            if (err) {
                throw `Error: ${err}`;
            } 

            throw $.text().replace(/^[\s]+/gm, '');
        }
    });
};

const sendSmile = (topicId) => {
    return request.get(`${TOPIC.edit}${topicId}`)
    .then(delay(Number(TOPIC.interval)))
    .then($ => {
        const err = $('#bodyarea > div:nth-child(1) > table > tbody .windowbg').text().trim();

        if (err) {
            throw `Error: ${err}`;
        }

        const form = normalizeFormEntries($('#postmodify').serializeArray(), TOPIC.form);

        return request.post({
            uri: TOPIC.send,
            formData: form,
        });   
    })
    .then($ => {
        if ($.text()) {
            const err = $('#bodyarea > div:nth-child(1) > table > tbody .windowbg').text().trim() || $('#errors').text().trim().replace(/\s{2,}/g, ' ');
            
            if (err) {
                if (/2 секунд/.test(err)) {
                    return sendSmile(topicId);
                } else {
                    throw `Error: ${err}`;
                }
            }

            throw $.text().replace(/^[\s]+/gm, '');
        }
    });
};

const getDelLinks = (topicId, morePages) => {
    return request.get(`${TOPIC.view}${topicId}.new`)
    .then($ => {
        const delMark = TOPIC.delmark;
        const delPosts= [];
        let postText  = '';
        
        $('.post').each((i, el) => {
            postText = $(el).text();

            if (postText === delMark) {
                delPosts.push($(el).siblings('table').find('a[onclick*="Удалить это сообщение"]').attr('href'));
            }
        });
        
        if (typeof morePages === 'number' && morePages > 0) {
            const reViews   = /\(Прочитано\s*(\d+)\s*раз\)/;
            const infoBox   = $('#top_subject').text();

            if (reViews.test(infoBox)) {
                const views = infoBox.match(reViews)[1];

                if (getStat(topicId)) {
                    addStat(topicId, views)
                } else {
                    const reTopicName   = /(?<=Тема:).+(?=\(Прочитано)/;
                    const topicName     = removeSmiles(infoBox.match(reTopicName)[0]);

                    if (reTopicName.test(infoBox)) {
                        addStat(topicId, views, topicName);
                    }
                }
            }

            let lastPage    = Number($('#quickModForm > table:nth-child(3) b').html()) - 1;
            let delPages    = [];
            
            if (lastPage >= morePages) {    
                while(morePages--) {
                    delPages.push(`${TOPIC.view}${topicId}.${--lastPage * 15}`);
                }
            }

            return Promise.all([delPosts, ...delPages.map((link) => {
                return getDelLinks(link);
            })])
        }

        return delPosts; 
    })
    .then(links => {
        if (Array.isArray(links[0])) {
            return links.reduce((prev, curr) => {
                return [
                    ...prev,
                    ...curr
                ];
            });
        }

        return links;
    });
}

const delSmile = (link) => {
    return request.get(link)
    .then($ => {
        const err = $('#errors').text();

        if (err) {
            throw `Error: ${err.trim().replace(/\s{2,}/g, ' ')}`;
        }
    });
}

const addStat = (topicId, views, topicName) => {
    const statPath = path.join(__dirname, TOPIC.stat);

    if (!fs.existsSync(statPath)) {
        fs.mkdirSync(statPath);
    }

    const date          = getDate();
    const statFileName  = `${date}.json`;
    const statFilePath  = path.join(statPath, statFileName);

    if (!fs.existsSync(statFilePath)) {
        fs.writeFileSync(statFilePath, '{}');
    }

    const stat = readJson(statFilePath);
    const time = getTime();

    views = +views;

    if (topicId in stat) {
        const topic     = stat[topicId];
        const pertime   = views - topic.total;

        topic.pertime.push([time, pertime]);
        topic.perday += pertime;
        topic.total = views;
    } else {
        stat[topicId] = {
            name: topicName || "",
            total: views,
            perday: 0,
            pertime: [
                [time, 0]
            ]
        }
    }

    saveJson(statFilePath, stat);
}

const getStat = (topicId, date) => {
    const stat = getStats(date);

    if (stat && (topicId in stat)) {
        return stat[topicId];
    }
    
    return false
}

const getStats = (date) => {
    const statPath = path.join(__dirname, TOPIC.stat);
    
    if (fs.existsSync(statPath)) {
        const statDate      = date || getDate();
        const statFileName  = `${statDate}.json`;
        const statFilePath  = path.join(statPath, statFileName);
    
        if (fs.existsSync(statFilePath)) {
            return readJson(statFilePath);
        }
    }
    
    return false
}

const printStatTable = (date) => {
    let files = fs.readdirSync(path.join(__dirname, TOPIC.stat));
    const numOfFiles = files.length;

    if (!numOfFiles) return;

    const reDate = /(\d+)-(\d+)-(\d+)/;

    files = files.sort((a, b) => {    
        const [aDate, aDay, aMonth, aYear] = a.match(reDate);
        const [bDate, bDay, bMonth, bYear] = b.match(reDate);
    
        if (bYear > aYear) return - 1;
        else if (bYear < aYear) return 1    
    
        if (bMonth > aMonth) return - 1;
        else if (bYear < aMonth) return 1;
        
        if (bDay > aDay) return - 1;
        else if (bDay < aDay) return 1    
    
        return 0;
    });

    const todayStat     = getStats(files[numOfFiles - 1].match(reDate)[0]);
    const yesterdayStat = (numOfFiles > 1) ? getStats(files[numOfFiles - 2].match(reDate)[0]) : null;
    const stats = [];

    for (const topic in todayStat) {
        stats.push({
            Topic: +topic,
            Name: todayStat[topic].name || '',
            Lately: todayStat[topic].pertime[todayStat[topic].pertime.length - 1][1] || 0,
            Today: todayStat[topic].perday || 0,
            Yesterday: (yesterdayStat && (topic in yesterdayStat)) ? yesterdayStat[topic].perday : 0,
            Total: todayStat[topic].total || 0,
        });
    }

    console.table(stats.sort((a, b) => b.Today - a.Today));
}

const smile = async () => {
    let numOfTopics;
    let fileLastMod;
    let fileTimeMod;
    let topics;
    let wait;
    let end;
    let statSends;
    let statDels;
    let loginAgain;
    let login;

    login       = 0;
    loginAgain  = minToMs(LOGIN.again)

    while (!login) {
        logUp(`[Login][${getTime().yellow}][${LOGIN.form.user}][Process...]`);
        try {
            await signIn();
            login = 1;
        } catch (e) {
            logUp(`[Login][${getTime().yellow}][${LOGIN.form.user}][${'Denied'.red}]`);
            logUp.done();

            fs.writeFileSync(path.join(__dirname, SETTINGS.error), `[${new Date().toLocaleString('ru')}]\n${e}\n`, {flag: 'a'});

            login   = 0;
            wait    = loginAgain;
            end     = Date.now() + wait;

            await timer(wait, () => {
                logUp(`[Waiting...][${timeDiff(Date.now(), end).yellow}]`);
            }, 200)();

            logUp.done();
        }
    }

    logUp(`[Login][${getTime().yellow}][${LOGIN.form.user}][${'Success'.green}]`);
    logUp.done();

    wait        = minToMs(SETTINGS.wait);
    fileTimeMod = fs.statSync(TOPIC.path).mtime;
    topics      = fileToArr(TOPIC.path);
    numOfTopics = topics.length;

    while (true) {
        fileLastMod = fs.statSync(TOPIC.path).mtime;

        if (fileTimeMod !== fileLastMod) {
            fileTimeMod = fileLastMod;
            topics      = fileToArr(TOPIC.path);
            numOfTopics = topics.length;
        }
        
        statSends = statDels = 0;

        logUp(`[Start][${getTime().yellow}]`);
        logUp.done();

        for (const topic of topics) {
            logUp(`[Smile][${getTime().yellow}][${topic}][0/0][${statSends}/${numOfTopics}][Deleting][Process...]`);

            let delLinks = [];

            try {
                delLinks = await getDelLinks(topic, Number(TOPIC.delPages));
            } catch (e) {
                fs.writeFileSync(path.join(__dirname, SETTINGS.error), `[${new Date().toLocaleString('ru')}]\n${e}\n`, {flag: 'a'});
            }
            
            const numOfDels  = delLinks.length;

            logUp(`[Smile][${getTime().yellow}][${topic}][${statDels}/${numOfDels}][${statSends}/${numOfTopics}][Deleting][Process...]`);
            
            for (const delLink of delLinks) {
                try {
                    await delSmile(delLink);
                    ++statDels;
                } catch (e) {
                    logUp(`[Smile][${getTime().yellow}][${topic}][${statDels}/${numOfDels}][${statSends}/${numOfTopics}][Deleting][${'Denied'.red}]`);
                    logUp.done();

                    fs.writeFileSync(path.join(__dirname, SETTINGS.error), `[${new Date().toLocaleString('ru')}]\n${e}\n`, {flag: 'a'});
                }

                logUp(`[Smile][${getTime().yellow}][${topic}][${statDels}/${numOfDels}][${statSends}/${numOfTopics}][Deleting][${'Success'.green}]`);
            }

            logUp(`[Smile][${getTime().yellow}][${topic}][${statDels}/${numOfDels}][${statSends}/${numOfTopics}][Sending][Process...]`);

            try {
                await sendSmile(topic);
            } catch (e) {
                logUp(`[Smile][${getTime().yellow}][${topic}][${statDels}/${numOfDels}][${statSends}/${numOfTopics}][Sending][[${'Denied'.red}]]`);
                logUp.done();

                fs.writeFileSync(path.join(__dirname, SETTINGS.error), `[${new Date().toLocaleString('ru')}]\n${e}\n`, {flag: 'a'});
            }

            logUp(`[Smile][${getTime().yellow}][${topic}][${statDels}/${numOfDels}][${++statSends}/${numOfTopics}][Sending][${'Success'.green}]`);
            logUp.done();

            statDels = 0;
        }

        printStatTable()
        
        end = Date.now() + wait;

        await timer(wait, () => {
            logUp(`[Waiting...][${timeDiff(Date.now(), end).yellow}]`);
        }, 200)();
    }
}

smile();
























