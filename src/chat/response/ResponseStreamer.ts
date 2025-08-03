import logger from '../../util/Logger';
import { EventEmitter } from 'events';

interface StreamerOptions {
    messages: {
        'chat-delimiter': string;
        'chat-prefix': string;
        'illegal-response-tokens': string[];
        'chunk-delimiters': string[];
    };
    [key: string]: any;
}

interface OobaClient {
    on(event: string, listener: (data: any) => void): void;
    stop(): void;
}

interface ResponseHandler {
    [key: string]: any;
}

class ResponseStreamer extends EventEmitter {
    private options: StreamerOptions;
    private responseHandler: ResponseHandler;
    private ooba: OobaClient;
    private tokens: string[];
    private enclosureState: string | null;
    private abortStream: boolean;
    private chatDelimiter: string;
    private chatPrefix: string;
    private illegalTokens: string[];

    constructor(options: StreamerOptions, responseHandler: ResponseHandler, ooba: OobaClient) {
        super();
        this.options = options;
        this.responseHandler = responseHandler;
        this.ooba = ooba;
        // Handle events from the LLM API
        this.ooba.on('message', (message: string) => {
            // A message has completed
            logger.debug(`Received message from Oobabooga: ${message}`);
            this.emitChunk();
            // reset abort flag
            this.abortStream = false;
        });
        this.ooba.on('token', (token: string) => {
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

    receiveToken(token: string): void {
        // Check for illegal tokens
        let containsIllegalToken = false;
        const illegalTokenIndex = this.getIllegalTokenIndex(token);
        if (illegalTokenIndex !== -1) {
            logger.warn(`Token: ${token} contains illegal token, splitting`);
            const split = [token.slice(0, illegalTokenIndex), token.slice(illegalTokenIndex)];
            token = split[0];
            containsIllegalToken = true;
        }

        // Check for a delimited message
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

        if (containsIllegalToken) {
            this.abort();
        }
    }

    getIllegalTokenIndex(token: string): number {
        const illegalTokens = this.illegalTokens;
        const indices = illegalTokens.map(illegalToken => token.indexOf(illegalToken));
        const validIndices = indices.filter(i => i !== -1);
        if (validIndices.length === 0) return -1;
        return Math.min(...validIndices);
    }

    isTokenLegal(token: string): boolean {
        const illegalTokens = this.illegalTokens;
        const isIllegal = illegalTokens.some(illegalToken => token.includes(illegalToken));
        return !isIllegal;
    }

    getDelimiterIndex(token: string): number {
        // check for chat delimiter or prefix
        const delimiterIndex = token.indexOf(this.chatDelimiter);
        const prefixIndex = token.indexOf(this.chatPrefix);
        const indices = [delimiterIndex, prefixIndex].filter(i => i !== -1);
        if (indices.length === 0) return -1;
        return Math.min(...indices);
    }

    pushToken(token: string): void {
        this.tokens.push(token);
        this.emit('token', token);
    }

    processTokens(): void {
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

    emitChunk(): void {
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

    clear(): void {
        this.tokens = [];
        this.enclosureState = null;
    }

    abort(emit: boolean = true): void {
        if (emit) this.emitChunk();
        this.abortStream = true;
        this.ooba.stop();
        this.clear();
    }
}

export default ResponseStreamer;