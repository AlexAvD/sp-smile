const fs    = require('fs');
const iconv = require('iconv-lite');

const readJson = (pathToFile) => JSON.parse(fs.readFileSync(pathToFile));
const saveJson = (path, obj, separator) => {fs.writeFileSync(path, JSON.stringify(obj, null, separator), (err) => {if (err) console.log(err)})};

const normalizeSpaces = (str) => str.replace(/^\s+|\s(?=\s)|\s+$/g, '');
const removeSmiles = (str) => normalizeSpaces(str.replace(/[^\s\wа-яё.,\/#!$%\^&\*;:@{}=\-`"'+~()\[\]=\\]/ig, ' '));
const normalizeBody = (body) => iconv.encode(iconv.decode(body, 'win1251'), 'utf8');

const getFileModTime = (pathToFile) => fs.statSync(pathToFile).mtime;

const normalizeFormToSend = (formData) => {
    for (const field in formData) {
        if (field === 'subject' || field === 'message') {
            formData[field] = iconv.encode(removeSmiles(formData[field]), 'win1251');
        }
    }

    return formData;
}

const fileToArr = (pathToFile) => {
    const posts = fs.readFileSync(pathToFile).toString();
    const topics = posts.split('\r\n').map(line => +(line.match(/(?<=topic\,)\d{7}|^\d{7}$/g) || [''])[0]).filter(topic => topic);
    return topics;
};

module.exports = {
    readJson,
    saveJson,
    fileToArr,
    getFileModTime,
    normalizeBody,
    normalizeFormToSend,
    removeSmiles,
}