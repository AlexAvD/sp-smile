const cheerio   = require('cheerio');
const fs        = require('fs');
const logUp     = require('log-update');
const path      = require('path');
const colors    = require('colors');
const request = require('request-promise').defaults({
    jar: true, 
    encoding: null, 
    simple: false, 
    transform: (body) => cheerio.load(normalizeBody(body), { decodeEntities: false })
});

const {
    fileToArr,
    getFileModTime,
    normalizeBody,
    normalizeFormToSend,
    removeSmiles,
} = require('./helpers/common');

const {
    wait,
    timeDiff,
    getDateAndTime,
} = require('./helpers/time');

const {
    addStats,
    printStats
} = require('./stats')

const { log } = console;

const {
    login: LOGIN, 
    topic: TOPIC,
    error: ERROR,
    stats: STATS
} = require('./config.json');

const login = () => {
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

const getFormData = (topicId) => {
    return request.get(`${TOPIC.edit}${topicId}`)
    .then($ => {
        const err = $('#bodyarea > div:nth-child(1) > table > tbody .windowbg').text().trim();

        if (err) throw err;

        const form = {};

        $('#postmodify').serializeArray().forEach(el => {
            form[el.name] = el.value;
        });

        return form; 
    })
}

const sendPost = (formData) => {
    return request.post({
        uri: TOPIC.send,
        formData: formData,
    })
    .then($ => {
        if ($.text()) {
            const err = $('#bodyarea > div:nth-child(1) > table > tbody .windowbg').text().trim() || $('#errors').text().trim().replace(/\s{2,}/g, ' ');
            
            if (err) {
                if (/2 секунд/.test(err)) {
                    return false;
                } else {
                    throw `Error: ${err}`;
                }
            }

            throw $.text().replace(/^[\s]+/gm, '');
        }

        return true;
    })
}

const getDelLinksOnPage = ($) => {
    const postDelText = TOPIC.markToDel;
    const postDelLinks = [];
    let postText = '';
    let postDelLink;
    
    $('.post').each((i, el) => {
        postText = $(el).text();
        postDelLink = $(el).siblings('table').find('a[onclick*="Удалить это сообщение"]');

        if (postText === postDelText) {
            postDelLinks.push(postDelLink.attr('href'));
        }
    });

    return postDelLinks;
}

const getPagesWithDelLinks = (topicId, pages) => {
    return  request.get(`${TOPIC.view}${topicId}.new`)
    .then($ => {
        let pageLinks = [];
        let lastPage;

        if (typeof pages === 'number' && pages > 0) {
            lastPage = +$('#quickModForm > table:nth-child(3) .middletext > b:last-of-type').text() - 1;
            pageLinks = Array.from(new Array((pages <= lastPage) ? pages : lastPage) , () => `${TOPIC.view}${topicId}.${--lastPage * 15}`);
        }

        return Promise.all([$, ...pageLinks.map(pageLink => request.get(pageLink))]);
    });
}

const delPost = (link) => {
    return request.get(link)
    .then($ => {
        const err = $('#errors').text();

        if (err) {
            throw `Error: ${err.trim().replace(/\s{2,}/g, ' ')}`;
        }
    });
};

const getViews = (topicId) => {
    return request.get(`${TOPIC.view}${topicId}.new`)
    .then($ => {
        const err = $('#bodyarea > div:nth-child(1) > table > tbody .windowbg').text().trim() || $('#errors').text().trim().replace(/\s{2,}/g, ' ');

        if (err) throw err;

        const infoBox = $('#top_subject').text();
        const handledInfo = infoBox.match(/Тема:(.+)\(Прочитано\s*(\d+)\s*раз\)/);

        if (handledInfo) {  
            const topicName = removeSmiles(handledInfo[1]);
            const topicViews = +handledInfo[2];
            const { date, time } = getDateAndTime();

            return {
                date,
                time,
                topicId,
                name: topicName,
                views: topicViews
            };
        }
        
        return null;
    })
};

const getViewsFromPage = ($) => {
    const infoBox = $('#top_subject').text();
    const handledInfo = infoBox.match(/Тема:(.+)\(Прочитано\s*(\d+)\s*раз\)/);

    if (handledInfo) {  
        const topicName = removeSmiles(handledInfo[1]);
        const topicViews = +handledInfo[2];
        const { date, time } = getDateAndTime();

        return {
            date,
            time,
            name: topicName,
            views: topicViews
        }
    }
    
    return null;
}

const main = async () => {
    const pathToTopics          = path.join(__dirname, TOPIC.file);
    const pathToLogFile         = path.join(__dirname, ERROR.file);
    const pathToStatsDir        = path.join(__dirname, STATS.dir);
    const pathToTrackStatsDir   = path.join(__dirname, STATS.trackDir);
    const pathToTrackTopics     = path.join(__dirname, STATS.trackFile);
    const numOfDelPages         = +TOPIC.numOfDelPages;
    const nextSendTime          = +TOPIC.wait * 60000;
    const nextLoginAttemptTime  = +LOGIN.again * 60000;
    const sendInterval          = +TOPIC.interval * 1000;
    const frames = [
        ' | ',
        ' / ',
        ' - ',
        ' \\ '
    ];

    let trackTopicsStats;
    let waitingTimeLogin;
    let waitingTimeSend;
    let frame;

    let postsModTime = getFileModTime(pathToTopics);
    let topics = fileToArr(pathToTopics);
    let numOfTopics = topics.length;
    let postsLastModTime;

    let pagesWithDelLinks;
    let delLinks;
    let delCounter;
    let numOfDel;

    let stats;

    let sendCounter;
    let formData;
    let isSended;

    /* Вход в систему */

    while (true) {
        try {
            logUp(`[Login][${getDateAndTime().time.yellow}][${LOGIN.form.user}][Process...]`);

            await login();

            logUp(`[Login][${getDateAndTime().time.yellow}][${LOGIN.form.user}][${'Success'.green}]`);
            logUp.done();

            break;
        } catch (e) {
            fs.writeFileSync(path.join(pathToLogFile), `[${new Date().toLocaleString()}]\r\n${e}\r\n`, {flag: 'a'});

            logUp(`[Login][${getDateAndTime().time.yellow}][${LOGIN.form.user}][${'Error'.red}]`);
            logUp.done();
        }

        waitingTimeLogin = Date.now() + nextLoginAttemptTime;

        await wait(nextLoginAttemptTime, () => {
            const currTimeDiff = timeDiff(Date.now(), waitingTimeLogin).yellow;
            logUp(`[Waiting...][${currTimeDiff}]`);
        }, 200);
    }

    while (true) {

        /* Проверка изменений в фале */

        sendCounter = 0;
        stats = [];
        postsLastModTime = getFileModTime(pathToTopics);

        if (postsModTime !== postsLastModTime) {
            postsModTime = postsLastModTime;
            topics = fileToArr(pathToTopics);
            numOfTopics = topics.length;
        }

        for (const topic of topics) {
            pagesWithDelLinks = [];
            delLinks = [];
            delCounter = 0;
            numOfDel = 0;
            isSended = false;

            /* Поиск постов для удаления */

            try {
                logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][0/0][${sendCounter}/${numOfTopics}][Deleting][Search...]`);

                pagesWithDelLinks = await getPagesWithDelLinks(topic, numOfDelPages);
                delLinks = pagesWithDelLinks.reduce((delLinks, $) => [...delLinks, ...getDelLinksOnPage($)], []);
                numOfDel = delLinks.length;
                stats.push({
                    topicId: topic,
                    ...getViewsFromPage(pagesWithDelLinks[0])
                });

            } catch (e) {
                fs.writeFileSync(pathToLogFile, `[${new Date().toLocaleString('ru')}]\r\n${e}\r\n`, {flag: 'a'});

                logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][0/0][${sendCounter}/${numOfTopics}][Deleting][${'Error'.red}]`);
                logUp.done();
            }

            /* Удаление постов */

            for (const delLink of delLinks) {
                if (delLink) {
                    try {
                        logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][${delCounter}/${numOfDel}][${sendCounter}/${numOfTopics}][Deleting][Processing...]`);

                        await delPost(delLink);

                        logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][${++delCounter}/${numOfDel}][${sendCounter}/${numOfTopics}][Deleting][${'Success'.green}]`);
                    } catch (e) {
                        fs.writeFileSync(pathToLogFile, `[${new Date().toLocaleString('ru')}]\r\n${e}\r\n`, {flag: 'a'});
    
                        logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][${delCounter}/${numOfDel}][${sendCounter}/${numOfTopics}][Deleting][${'Error'.red}]`);
                        logUp.done();
                    }   
                }
            }

            /* Отправка */

            try {
                logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][${delCounter}/${numOfDel}][${sendCounter}/${numOfTopics}][Sending][Processing...]`);

                formData = await getFormData(topic);

                while (!isSended) {
                    waitingTimeSend = Date.now() + sendInterval;

                    await wait(sendInterval, () => {
                        const currTime = getDateAndTime().time.yellow;
                        const currTimeDiff = timeDiff(Date.now(), waitingTimeSend).yellow;

                        logUp(`[Smile][${currTime}][${topic}][${delCounter}/${numOfDel}][${sendCounter}/${numOfTopics}][Sending][${currTimeDiff}]`);
                    });

                    isSended = await sendPost(normalizeFormToSend({...formData, ...TOPIC.form}));
                }

                logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][${delCounter}/${numOfDel}][${++sendCounter}/${numOfTopics}][Sending][${'Success'.green}]`);
            } catch (e) {
                fs.writeFileSync(pathToLogFile, `[${new Date().toLocaleString('ru')}]\r\n${e}\r\n`, {flag: 'a'});

                logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][${delCounter}/${numOfDel}][${sendCounter}/${numOfTopics}][Sending][[${'Error'.red}]]`);
                logUp.done();
            }
        }

        logUp.done();

        /* Статистика */

        addStats(stats, pathToStatsDir);
        printStats(pathToStatsDir);

        trackTopicsStats = (fs.existsSync(pathToTrackTopics)) ? fileToArr(pathToTrackTopics) : [];

        if (trackTopicsStats.length) {
            try {
                addStats(await Promise.all(trackTopicsStats.map(topic => getViews(topic))), pathToTrackStatsDir);
                printStats(pathToTrackStatsDir);
            } catch (e) {
                fs.writeFileSync(pathToLogFile, `[${new Date().toLocaleString('ru')}]\r\n${e}\r\n`, {flag: 'a'});

                logUp(`[Track-stats][${getDateAndTime().time.yellow}][${'Error'.red}]`);
                logUp.done();            
            }
        }

        waitingTimeSend = Date.now() + nextSendTime;
        frame = -1;

        await wait(nextSendTime, () => {
            const currFrame = frames[frame = ++frame % frames.length];
            const currTimeDiff = timeDiff(Date.now(), waitingTimeSend).yellow;

            logUp(`[Waiting${currFrame}][${currTimeDiff}]`);
        });
    }
};

main();

/* (async () => {
    await login();
    try {
        const pages = await getPagesWithDelLinks(1889576, 1);
        const delLinks = pages.reduce((delLinks, $) => [...delLinks, ...getDelLinksOnPage($)], []);
        console.log(delLinks);
    } catch (e) {
        console.log(e);
    }
    
})();

 */


















