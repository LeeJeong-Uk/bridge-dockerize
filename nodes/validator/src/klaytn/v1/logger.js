'use strict';

const winston = require('winston');
const moment = require('moment');
const config = require(ROOT + '/config');

const tsFormat = function () {
    return moment().format('YYYY-MM-DD HH:mm:ss');
}

//////////////////////////////////////////////////////////////////////////////////////////
const myFormat = winston.format.printf(info => {
    return '[KLAYTN-v1] ' + tsFormat() + ' ' + info.message;
});

// Normal Logger: Winston
let logger = winston.createLogger({
    level: config.system.logLevel || 'info',
    format: winston.format.combine(
        myFormat
    ),
    transports: [
        new(winston.transports.Console)({
            colorize: true,
            handleExceptions: true,
        }),

        new(require('winston-daily-rotate-file'))({
            filename: './logs/klaytn/v1/general.log',
            json: false
        }),
    ],
    exceptionHandlers: [
        new(require('winston-daily-rotate-file'))({
            filename: './logs/klaytn/v1/exception.log',
            humanReadableUnhandledException: true,
            handleExceptions: true,
            json: false
        }),
    ]
});

module.exports = logger;
