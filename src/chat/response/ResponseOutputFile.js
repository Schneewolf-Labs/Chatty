const fs = require('fs');
const path = require('path');
const logger = require('../../util/Logger');

class ResponseOutputFile {
    constructor(config, responseHandler) {
        this.config = config;
        this.responseHandler = responseHandler;
        this.outputPath = path.join(process.cwd(), config.oobabooga.output_location);

        this.responses = [];
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
        const response = this.responses.join('');
        fs.writeFileSync(this.outputPath, response);
    }

}

module.exports = ResponseOutputFile;