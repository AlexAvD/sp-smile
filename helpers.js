const fs    = require('fs');
const iconv = require('iconv-lite');

const readJson = (pathToFile) => JSON.parse(fs.readFileSync(pathToFile));

const saveJson = (path, obj, separator) => {
    fs.writeFileSync(path, JSON.stringify(obj, null, separator), (err) => {if (err) console.log(err)});
};

const removeSmiles = (str) => str.replace(/(^\s+)|(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])|(\s(?=\s))|(\s+$)/g, '');

const normalizeInputEncode = (str) => {
    return iconv.encode(removeSmiles(str), 'win1251');
}

const normalizeBodyEncode = (body) => iconv.encode(iconv.decode(body, 'win1251'), 'utf8');

const fileToArr = (pathToFile) => {
    const str   = fs.readFileSync(pathToFile).toString();
    const lines = str.split('\r\n').map(el => {
        const regExp = /(?<=topic\,)\d{7}|^\d{7}$/;
        el = el.trim();
        if (el) {
            if (regExp.test(el)) {
                return el.match(regExp)[0];    
            } 
        }
        return el;
        
    });

    return lines.filter(el => {
        return el.replace(/[^\d]/g, '');
    });
};

const delay = (ms) => (result) => new Promise(resolve => setTimeout(() => resolve(result), ms));

const normalizeFormEntries = (arr, add) => {
    const form = {};

    arr.forEach(el => {
        form[normalizeInputEncode(el.name)] = normalizeInputEncode(el.value);
    });

    if (add && typeof add === 'object') {
        for (const field in add) {
            form[normalizeInputEncode(field)] = normalizeInputEncode(add[field]);
        }
    }

    return form;
}

const getTime = () => {
    const date      = new Date();
    const hours     = date.getHours();
    const minutes   = date.getMinutes();
    const seconds   = date.getSeconds();

    return `${
        (hours < 10) ? '0' + hours : hours
    }:${
        (minutes < 10) ? '0' + minutes : minutes
    }:${
        (seconds < 10) ? '0' + seconds : seconds
    }`;
}

const getDate = () => {
    const now   = new Date();
    const day   = now.getDate();
    const month = now.getMonth();
    const year  = now.getFullYear();
    
    return `${(day < 10) ? '0' + day : day}-${(month < 10) ? '0' + month : month}-${year}`;
}

const timer = (waitMs, log, logMs) => {
    return (result) => {
        const interval = setInterval(log, logMs);

        return new Promise(res => {
            setTimeout(() => {
                clearInterval(interval);
    
                res(result);
            }, waitMs);
        })
    }
}

const timeDiff = (msA, msB) => {
    const diff = Math.abs(msA - msB);

    const rawSeconds    = Math.floor(diff / 1000);
    const rawMinutes    = Math.floor(rawSeconds / 60);
    const hours         = Math.floor(rawMinutes / 60);

    const seconds       = rawSeconds % 60;
    const minutes       = rawMinutes % 60;
    
    return `${
        (hours < 10) ? '0' + hours : hours
    }:${
        (minutes < 10) ? '0' + minutes : minutes
    }:${
        (seconds < 10) ? '0' + seconds : seconds
    }`;
}

const minToMs = (min) => min * 1000 * 60;

module.exports = {
    readJson,
    saveJson,
    fileToArr,
    normalizeInputEncode,
    normalizeBodyEncode,
    normalizeFormEntries,
    removeSmiles,
    delay,
    getTime,
    getDate,
    timer,
    timeDiff,
    minToMs
}