const badwords = require('bad-words');
const filter = new badwords();
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

class MessageSanitizer {
    constructor(options) {
        this.options = options;
    }

    shouldReject(message) {
        // Check for profanity
        if (this.options['reject-profanity'] && filter.isProfane(message)) {
            //console.info(`rejected profane message from Oobabooga`);
            message = this.options['profanity-replacement'];
            this.speechBuffer = message;
            return true;
        }
        // Check for negativity
        if (this.options['reject-negativity']) {
            const score = sentiment.analyze(message).score;
            const threshold = this.options['sentiment-threshold'];
            console.info(`sentiment score: ${score}`);
            if (score < threshold) {
                console.info(`rejected negative (${score}) message from Oobabooga`);
                return true;
            }
        }
        return false;
    }

    sanitize(message) {
        // Strip any URLs from the message
        message = message.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '');
        // Strip things contained in [] brackets
        message = message.replace(/\[.*?\]/g, '');

        return message;
    }

    trimResponse(message) {
        // End response before first \"
        const end = message.indexOf('\"');
        if (end > 0) message = message.substring(0, end);
        // Strip any trailing whitespace
        message = message.trim();
        return message;
    }
}

module.exports = MessageSanitizer;