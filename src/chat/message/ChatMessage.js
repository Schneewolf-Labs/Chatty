const logger = require('../../util/logger');

class ChatMessage {
    constructor(author, text, options = {}) {
        this.author = author;
        this.text = text;
        this.timestamp = Date.now();
        this.options = options;

        this.channel = null;
        this.directReply = false;
        this.isReply = false;
    }

    reply(message) {
        logger.error(`reply not implemented but got message: ${message}`);
    }
}

module.exports = ChatMessage;