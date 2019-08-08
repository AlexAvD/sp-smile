const {
    timeToSec,
    secToTime
} = require('./helpers');

const sec = timeToSec('20:03:04');
console.log(sec);
console.log(secToTime(sec));