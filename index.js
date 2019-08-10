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
    fileToArr,
    getFileModTime,
    normalizeBodyEncode,
    normalizeFormEntries,
    removeSmiles,
} = require('./helpers/common');

const {
    delay,
    timer,
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

            return {
                topicId,
                name: topicName,
                views: topicViews
            }
        }
        
        return null;
    })
};

const main = async () => {
    const pathToTopics = path.join(__dirname, TOPIC.file);
    const pathToLogFile = path.join(__dirname, ERROR.file);
    const pathToStatsDir = path.join(__dirname, STATS.dir);
    const pathToTrackStatDir = path.join(__dirname, STATS.trackDir);
    const pathToTrackTopics = path.join(__dirname, STATS.trackFile);
    const nextSendTime = TOPIC.wait * 60000;
    const nextLoginAttemptTime = LOGIN.again * 60000;
    const frames = [
        '.  ',
        '.. ',
        '...'
    ];

    let trackTopics;
    let waitingTimeLogin;
    let waitingTimeSend;
    let frame;

    let postsModTime = getFileModTime(pathToTopics);
    let topics = fileToArr(pathToTopics);
    let numOfTopics = topics.length;
    let postsLastModTime;

    let smileDelLinks;
    let smileDelCounter;
    let numOfSmileDel;
    let smileSendCounter;

    while (true) {
        try {
            logUp(`[Login][${getDateAndTime().time.yellow}][${LOGIN.form.user}][Process...]`);

            await signIn();

            logUp(`[Login][${getDateAndTime().time.yellow}][${LOGIN.form.user}][${'Success'.green}]`);
            logUp.done();

            break;
        } catch (e) {
            fs.writeFileSync(path.join(pathToLogFile), `[${new Date().toLocaleString()}]\r\n${e}\r\n`, {flag: 'a'});

            logUp(`[Login][${getDateAndTime().time.yellow}][${LOGIN.form.user}][${'Error'.red}]`);
            logUp.done();
        }

        waitingTimeLogin = Date.now() + nextLoginAttemptTime;

        await timer(nextLoginAttemptTime, () => {
            logUp(`[Waiting...][${timeDiff(Date.now(), waitingTimeLogin).yellow}]`);
        }, 200)();
    }

    while (true) {
        /* Проверка изменений в фала */

        postsLastModTime = getFileModTime(pathToTopics);

        if (postsModTime !== postsLastModTime) {
            postsModTime = postsLastModTime;
            topics = fileToArr(pathToTopics);
            numOfTopics = topics.length;
        }

        smileSendCounter = 0;
        
        for (const topic of topics) {
            smileDelLinks = [];
            smileDelCounter = 0;
            numOfSmileDel = 0;

            /* Удаление  */
            try {
                logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][0/0][${smileSendCounter}/${numOfTopics}][Deleting][Search...]`);

                smileDelLinks = await getDelLinks(topic, +TOPIC.numOfDelPages);
                numOfSmileDel = smileDelLinks.length;
            } catch (e) {
                fs.writeFileSync(pathToLogFile, `[${new Date().toLocaleString('ru')}]\r\n${e}\r\n`, {flag: 'a'});

                logUp.done();
                logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][0/0][${smileSendCounter}/${numOfTopics}][Deleting][${'Success'.green}]`);
                logUp.done();
            }
            
            for (const smileDelLink of smileDelLinks) {
                try {
                    logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][${smileDelCounter}/${numOfSmileDel}][${smileSendCounter}/${numOfTopics}][Deleting][Processing...]`);

                    await delSmile(smileDelLink);

                    logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][${++smileDelCounter}/${numOfSmileDel}][${smileSendCounter}/${numOfTopics}][Deleting][${'Success'.green}]`);
                } catch (e) {
                    fs.writeFileSync(pathToLogFile, `[${new Date().toLocaleString('ru')}]\r\n${e}\r\n`, {flag: 'a'});

                    logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][${smileDelCounter}/${numOfSmileDel}][${smileSendCounter}/${numOfTopics}][Deleting][${'Error'.red}]`);
                    logUp.done();
                }
            }

            /* Отправка */

            try {
                logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][${smileDelCounter}/${numOfSmileDel}][${smileSendCounter}/${numOfTopics}][Sending][Processing...]`);

                await sendSmile(topic);

                logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][${smileDelCounter}/${numOfSmileDel}][${++smileSendCounter}/${numOfTopics}][Sending][${'Success'.green}]`);
            } catch (e) {
                fs.writeFileSync(pathToLogFile, `[${new Date().toLocaleString('ru')}]\r\n${e}\r\n`, {flag: 'a'});

                logUp(`[Smile][${getDateAndTime().time.yellow}][${topic}][${smileDelCounter}/${numOfSmileDel}][${smileSendCounter}/${numOfTopics}][Sending][[${'Error'.red}]]`);
                logUp.done();
            }
        }

        logUp.done();

        /* Статистика */

        try {
            logUp(`[Stats][${getDateAndTime().time.yellow}][Collection...]`);

            addStats(await Promise.all(topics.map(topic => getViews(topic))), pathToStatsDir);

            logUp(`[Stats][${getDateAndTime().time.yellow}][${'Success'.green}]`);
            logUp.done();

            printStats(pathToStatsDir);

            trackTopics = (fs.existsSync(pathToTrackTopics)) ? fileToArr(pathToTrackTopics) : [];
            
            if (trackTopics.length) {
                logUp(`[Stats][${getDateAndTime().time.yellow}][Collection...]`);

                addStats(await Promise.all(trackTopics.map(topic => getViews(topic))), pathToTrackStatDir);

                logUp(`[Stats][${getDateAndTime().time.yellow}][${'Success'.green}]`);
                logUp.done();

                printStats(pathToTrackStatDir);
            }
        } catch (e) {
            fs.writeFileSync(pathToLogFile, `[${new Date().toLocaleString('ru')}]\r\n${e}\r\n`, {flag: 'a'});

            logUp(`[${getDateAndTime().time.yellow}][${'Error'.red}]`);
            logUp.done();
        }

        waitingTimeSend = Date.now() + nextSendTime;
        frame = -1;

        await timer(nextSendTime, () => {
            logUp(`[Waiting${frames[frame = ++frame % frames.length]}][${timeDiff(Date.now(), waitingTimeSend).yellow}]`);
        }, 200)();
    }
};

main();























