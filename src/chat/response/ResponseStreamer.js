const logger = require('../../util/Logger');
const EventEmitter = require('events');

class ResponseStreamer extends EventEmitter {
    constructor(options, responseHandler) {
        super();
        this.options = options;
        this.responseHandler = responseHandler;

        this.tokens = [];
    }

    receiveToken(token) {
        this.tokens.push(token);
        this.emit('token', token);
        this.processTokens();
    }

    processTokens() {
        const options = this.options.messages;
        // Check if we can chunk these tokens
        const chunkSize = options['response-chunk-size'];
        // TODO: use chunk size to limit chunk length
        const lastToken = this.tokens[this.tokens.length - 1];
        // if token contains punctuation, or newline emit the chunk
        const punctuation = options['chunk-delimiters'];
        const containsPunctuation = punctuation.some(p => lastToken.includes(p));
        if (containsPunctuation) {
            // check if token should be split
            const shouldSplit = lastToken.length > 1 && lastToken[1] === ' ';
            if (shouldSplit) {
                // split token
                const split = lastToken.split(' ');
                // replace last token with first split
                this.tokens[this.tokens.length - 1] = split[0];
                // emit then receive second split
                this.emitChunk();
                this.receiveToken(split[1]);
            } else {
                this.emitChunk();
            }
        }
    }

    emitChunk() {
        const chunk = this.tokens.join('');
        if (!chunk) {
            logger.debug(`ResponseStreamer got empty chunk, refusing to emit`);
            return;
        }
        logger.debug(`ResponseStreamer emitting chunk: ${chunk}`);
        this.emit('chunk', chunk);
        this.clear();
    }

    clear() {
        this.tokens = [];
    }
}

module.exports = ResponseStreamer;