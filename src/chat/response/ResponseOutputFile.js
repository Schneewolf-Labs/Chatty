const process = require('process');
const fs = require('fs');
const path = require('path');
const logger = require('../../util/logger');
const ChatServiceInterface = require('../ChatServiceInterface');

class ResponseOutputFile extends ChatServiceInterface {
    constructor(config) {
        super();
        this.config = config;
        this.outputPath = path.join(process.cwd(), config.oobabooga.output_location);

        this.responses = [];
    }

    sendMessage(message) {
        logger.debug(`ResponseOutputFile got message: ${message}`);
        this.receiveResponse(message);
    }

    sendImage() {
        logger.debug('ResponseOutputFile ignoring request to send image');
    }

    sendTyping() {
        logger.debug('ResponseOutputFile ignoring request to send typing indicator');
    }

    receiveResponse(response) {
        this.responses.push(response);
        this.updateResponseFile();
        setTimeout(() => {
            const response = this.responses.shift();
            logger.debug(`ResponseOutputFile expiring response: ${response}`);
            this.updateResponseFile();
        }, this.config.messages['response-expire-time']);
    }

    updateResponseFile() {
        const response = this.responses.join(' ');
        fs.writeFileSync(this.outputPath, response);
    }

}

module.exports = ResponseOutputFile;