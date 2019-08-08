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

const delay = (ms) => (result) => new Promise(resolve => setTimeout(() => resolve(result), ms));

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

const timeToSec = (time) => {
    const [hours, minutes, seconds] = time.split(':');
    return +seconds + (+minutes * 60) + (+hours * 3600);
};

const secToTime = (seconds) => {
    const rawMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(rawMinutes / 60);
    const minutes = rawMinutes % 60;

    seconds %= 60;
    
    return `${
        (hours < 10) ? '0' + hours : hours
    }:${
        (minutes < 10) ? '0' + minutes : minutes
    }:${
        (seconds < 10) ? '0' + seconds : seconds
    }`;
}



module.exports = {
    delay,
    getTime,
    getDate,
    timer,
    timeDiff,
    minToMs,
    timeToSec,
    secToTime
}