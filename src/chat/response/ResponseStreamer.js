const logger = require('../../util/logger');
const EventEmitter = require('events');

class ResponseStreamer extends EventEmitter {
    constructor(options, responseHandler, ooba) {
        super();
        this.options = options;
        this.responseHandler = responseHandler;
        this.ooba = ooba;
        // Handle events from the LLM API
        this.ooba.on('message', (message) => {
            // A message has completed
            logger.debug(`Received message from Oobabooga: ${message}`);
            this.emitChunk();
            // reset abort flag
            this.abortStream = false;
        });
        this.ooba.on('token', (token) => {
            // Ooba is streaming tokens
            logger.debug(`Received token from Oobabooga: ${token}`);
            if (this.abortStream) return;
            if (!token) return;
            //this.emit('token', token);
            this.receiveToken(token);
        });

        this.tokens = [];
        this.enclosureState = null;
        this.abortStream = false;

        this.chatDelimiter = options.messages['chat-delimiter'];
        this.chatPrefix = options.messages['chat-prefix'];
        this.illegalTokens = options.messages['illegal-response-tokens'];
    }

    receiveToken(token) {
        const isLegal = this.isTokenLegal(token);
        if (!isLegal) {
            logger.debug(`Token: ${token} is illegal, aborting stream`);
            this.abort();
            return;
        }
        const delimiterIndex = this.getDelimiterIndex(token);
        if (delimiterIndex !== -1) {
            logger.warn(`Token: ${token} contains delimiter, splitting`);
            const split = [token.slice(0, delimiterIndex), token.slice(delimiterIndex)];
            token = split[0];
            this.pushToken(token);
            this.abort();
            return;
        }
        this.pushToken(token);
        this.processTokens();
    }

    isTokenLegal(token) {
        const illegalTokens = this.illegalTokens;
        const isIllegal = illegalTokens.some(illegalToken => token.includes(illegalToken));
        return !isIllegal;
    }

    getDelimiterIndex(token) {
        // check for chat delimiter or prefix
        const delimiterIndex = token.indexOf(this.chatDelimiter);
        const prefixIndex = token.indexOf(this.chatPrefix);
        const indices = [delimiterIndex, prefixIndex].filter(i => i !== -1);
        if (indices.length === 0) return -1;
        return Math.min(...indices);
    }

    pushToken(token) {
        this.tokens.push(token);
        this.emit('token', token);
    }

    processTokens() {
        const options = this.options.messages;
        
        const lastToken = this.tokens[this.tokens.length - 1];
        // Check if the token is part of a numbered list
        const previousToken = this.tokens[this.tokens.length - 2];
        if (previousToken && previousToken.match(/^\d+$/)) {
            // The previous token is a number, this token is part of a numbered list
            return;
        }
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
        let chunk = this.tokens.join('');
        if (!chunk) {
            logger.debug(`ResponseStreamer got empty chunk, refusing to emit`);
            return;
        }
        // One last check for delimiters
        const delimiterIndex = this.getDelimiterIndex(chunk);
        if (delimiterIndex !== -1) {
            logger.warn(`Chunk: ${chunk} contains delimiter, splitting`);
            const split = [chunk.slice(0, delimiterIndex), chunk.slice(delimiterIndex)];
            chunk = split[0];
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
        this.emitChunk();
        this.abortStream = true;
        this.clear();
    }
}

module.exports = ResponseStreamer;