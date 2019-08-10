const fs    = require('fs');
const iconv = require('iconv-lite');

const readJson = (pathToFile) => JSON.parse(fs.readFileSync(pathToFile));
const saveJson = (path, obj, separator) => {fs.writeFileSync(path, JSON.stringify(obj, null, separator), (err) => {if (err) console.log(err)})};

const normalizeSpaces = (str) => str.replace(/^\s+|\s(?=\s)|\s+$/g, '');
const removeSmiles = (str) => normalizeSpaces(str.replace(/[^\s\wа-яё.,\/#!$%\^&\*;:@{}=\-`"'+~()\[\]=\\]/ig, ' '));
const normalizeInputEncode = (str) => iconv.encode(removeSmiles(str), 'win1251');
const normalizeBodyEncode = (body) => iconv.encode(iconv.decode(body, 'win1251'), 'utf8');

const getFileModTime = (pathToFile) => fs.statSync(pathToFile).mtime;

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
    normalizeInputEncode,
    normalizeBodyEncode,
    normalizeFormEntries,
    removeSmiles,
}