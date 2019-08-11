const {
    timeToSec,
    secToTime,
    timeToStr,
    getDateAndTime,
    getTime,
    wait,
    timeDiff
} = require('./helpers/time');

const {
    fileToArr
} = require('./helpers/common');

const fs = require('fs');
const querystring = require('querystring');

const { log } = console;

console.log(timeDiff(Date.now(), Date.now() + 3000))