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

const {
    printStats
} = require('./stats');

const fs = require('fs');
const querystring = require('querystring');

const { log } = console;

printStats('./statistics/');