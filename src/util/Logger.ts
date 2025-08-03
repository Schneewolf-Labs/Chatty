import pino from 'pino';
import config from './Config';

interface LoggerOptions {
    level: string;
    transport?: {
        target: string;
    };
}

const options: LoggerOptions = {
    level: config.logger.level
};

if (config.logger.pretty) {
    options.transport = {
        target: 'pino-pretty'
    };
}

const logger = pino(options);

export default logger;