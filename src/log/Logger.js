const pino = require('pino');
const config = require('../config/Config');

const options = {
    level: config.logger.level
};
if (config.logger.pretty) {
    options.transport = {
        target: 'pino-pretty'
    }
}

const logger = pino(options);

module.exports = logger;