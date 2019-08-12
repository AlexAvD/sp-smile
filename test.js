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

const {
    bgMagenta
} = require('colors');

const { 
    table,
    getBorderCharacters
} = require('table');

const { log } = console;

// printStats('./statistics');