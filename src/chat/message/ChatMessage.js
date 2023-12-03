const logger = require('../../util/logger');

class ChatMessage {
    constructor(author, text, options = {}) {
        this.author = author;
        this.text = text;
        this.timestamp = Date.now();
        this.options = options;

        this.attachments = [];

        this.channel = null;
        this.directReply = false;
        this.isReply = false;
    }

    reply(message) {
        logger.error(`reply not implemented but got message: ${message}`);
    }

    getText() {
        let text = this.text;
        if (this.attachments.length > 0) {
            text += '\n';
            this.attachments.forEach(attachment => {
                text += `[${attachment.type}:${attachment.caption}]\n`;
            });
        }
        return text;
    }
}

module.exports = ChatMessage;