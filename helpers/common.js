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


module.exports = {
    readJson,
    saveJson,
    fileToArr,
    normalizeInputEncode,
    normalizeBodyEncode,
    normalizeFormEntries,
    removeSmiles,
}