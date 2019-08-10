const timeToStr = (hours, minutes, seconds) => {
    hours   = +hours || 0;
    minutes = +minutes || 0;
    seconds = +seconds || 0;

    return `${(hours < 10) ? '0' + hours : hours}:${(minutes < 10) ? '0' + minutes : minutes}:${(seconds < 10) ? '0' + seconds : seconds}`;
}

const getDateAndTime = (...date) => {
    const {
        year,
        month,
        day,
        hours,
        minutes,
        seconds
    } = (new Date(...date)).toLocaleString().match(/(?<year>\d+)-(?<month>\d+)-(?<day>\d+) (?<hours>\d+):(?<minutes>\d+):(?<seconds>\d+)/).groups;

    return {
        time: timeToStr(hours, minutes, seconds),
        date: `${(day < 10) ? '0' + day : day}-${(month < 10) ? '0' + month : month}-${year}`
    };
}

const getTime = () => {
    const date      = new Date();
    const hours     = date.getHours();
    const minutes   = date.getMinutes();
    const seconds   = date.getSeconds();

    return timeToStr(hours, minutes, seconds);
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

        return new Promise(resolve => {
            setTimeout(() => {
                clearInterval(interval);
    
                resolve(result);
            }, waitMs);
        })
    }
}

const delay = (ms) => (result) => new Promise(resolve => setTimeout(() => resolve(result), ms));

const timeDiff = (msA, msB) => {
    const diff          = Math.abs(msA - msB);

    const rawSeconds    = Math.floor(diff / 1000);
    const rawMinutes    = Math.floor(rawSeconds / 60);
    const hours         = Math.floor(rawMinutes / 60);

    const seconds       = rawSeconds % 60;
    const minutes       = rawMinutes % 60;
    
    return timeToStr(hours, minutes, seconds);
}

const minToMs = (min) => min * 1000 * 60;

const timeToSec = (time) => {
    const [hours, minutes, seconds] = time.split(':');
    return +seconds + (+minutes * 60) + (+hours * 3600);
};

const secToTime = (seconds) => {
    const rawMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(rawMinutes / 60);
    const minutes = rawMinutes % 60;
    
    return timeToStr(hours, minutes, seconds % 60);
}

module.exports = {
    delay,
    getTime,
    getDate,
    timer,
    timeDiff,
    minToMs,
    timeToSec,
    secToTime,
    getDateAndTime
}