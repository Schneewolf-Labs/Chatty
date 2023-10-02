const logger = require('../../util/Logger');
const EventEmitter = require('events');

class ResponseStreamer extends EventEmitter {
    constructor(options, responseHandler) {
        super();
        this.options = options;
        this.responseHandler = responseHandler;

        this.tokens = [];
        this.enclosureState = null;
        this.abortStream = false;
    }

    receiveToken(token) {
        this.tokens.push(token);
        this.emit('token', token);
        this.processTokens();
    }

    processTokens() {
        const options = this.options.messages;
        
        const lastToken = this.tokens[this.tokens.length - 1];
        // if token contains punctuation, or newline emit the chunk
        const punctuation = options['chunk-delimiters'];
        const containsPunctuation = punctuation.some(p => lastToken.includes(p));

        // Check for enclosures
        const openingEnclosures = ['{', '[', '('];
        const closingEnclosures = ['}', ']', ')'];

        if (openingEnclosures.includes(lastToken)) {
            this.enclosureState = lastToken;
        } else if (this.enclosureState && closingEnclosures.includes(lastToken)) {
            if (openingEnclosures.indexOf(this.enclosureState) === closingEnclosures.indexOf(lastToken)) {
                this.enclosureState = null;
                this.emitChunk();
                return;
            }
        }

        if (!this.enclosureState && containsPunctuation) {
            const shouldSplit = lastToken.length > 1 && lastToken[1] === ' ';
            if (shouldSplit) {
                const split = lastToken.split(' ');
                this.tokens[this.tokens.length - 1] = split[0];
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
        this.enclosureState = null;
    }

    abort() {
        this.abortStream = true;
        this.clear();
    }
}

module.exports = ResponseStreamer;