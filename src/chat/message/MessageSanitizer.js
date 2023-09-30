const logger = require('../../util/Logger');
const badwords = require('bad-words');
const filter = new badwords();
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

class MessageSanitizer {
    constructor(options, persona, chatDelimiter) {
        this.options = options;
        this.persona = persona;
        this.chatDelimiter = chatDelimiter;
    }

    shouldReject(message) {
        // Check for profanity
        if (this.options['reject-profanity'] && filter.isProfane(message)) {
            logger.debug(`got profrane message`);
            message = this.options['profanity-replacement'];
            this.speechBuffer = message;
            return true;
        }
        // Check for negativity
        if (this.options['reject-negativity']) {
            const score = sentiment.analyze(message).score;
            const threshold = this.options['sentiment-threshold'];
            logger.debug(`sentiment score: ${score}`);
            if (score < threshold) {
                logger.debug(`rejected negative (${score}) message`);
                return true;
            }
        }
        return false;
    }

    sanitize(message) {
        // Strip persona name chat prefix
        message = message.replace(this.persona.name+":", '');
        // Strip any mentions from the message
        message = message.replace(/@[\S]+/g, '');
        // Strip any URLs from the message
        message = message.replace(/(?:https?|ftp):\/\/[^\s]+/g, '');
        // Strip things contained in [] brackets
        message = message.replace(/\[.*?\]/g, '');
        // Remove actions in *'s
        if (this.options['remove-actions']) message = message.replace(/\*.*?\*/g, '');

        return message;
    }

    trimResponse(message) {
        // End response before first \"
        const end = message.indexOf(this.chatDelimiter);
        if (end > 0) message = message.substring(0, end);
        // Strip any trailing whitespace
        message = message.trim();
        return message;
    }
}

module.exports = MessageSanitizer;