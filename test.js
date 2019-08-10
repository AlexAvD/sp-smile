const {
    timeToSec,
    secToTime,
    timeToStr,
    getDateAndTime,
    getTime
} = require('./helpers/time');

const {
    fileToArr
} = require('./helpers/common');

const fs = require('fs');

const { log } = console;

log(fs.readdirSync('./'));
