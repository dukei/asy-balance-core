import {Log4js} from "log4js";

const log4js: Log4js = require('log4js');
log4js.configure({
    appenders: {
        err: { type: 'stderr'},
        def: { type: 'file', filename: 'abc.log' }
    },
    categories: { default: { appenders: ['def','err'], level: 'trace' } }
});

const log = log4js.getLogger("abc");
export default log;