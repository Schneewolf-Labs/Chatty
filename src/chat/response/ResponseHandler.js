const logger = require('../../util/logger');
const EventEmitter = require('events');
const OobaClient = require('../../client/OobaClient');
const ResponseStreamer = require('./ResponseStreamer');

class ResponseHandler extends EventEmitter {
    constructor(config, persona) {
        super();
        this.config = config;
        this.ooba = new OobaClient(config.oobabooga);
        this.persona = persona;
        this.responseStreamer = new ResponseStreamer(config, this);

        this.responseQueue = [];
        this.responseHistory = {};
        this.lastResponseID = 0;
        this.nextResponseID = 0;
        this.processingResponseID = 0;
        this.awaitingResponse = false;
        this.responseBuffer = [];

        // Setup prompts from the config
        this.personaPrompt = config.messages['persona-prompt'] + persona.directive + "\n";
        this.chatPrompt = persona.insertName(config.messages['prompt']) 
                        + persona.insertName(config.messages['safety-prompt'])
                        + config.messages['chat-history-prefix'];
        this.chatDelimiter = config.messages['chat-delimiter'];
        this.responsePrefix = persona.insertName(config.messages['prompt-response-prefix']);
        // Replace {DELIMITER} with the chat delimiter in the response prefix
        this.responsePrefix = this.responsePrefix.replace('{DELIMITER}', this.chatDelimiter);
        // Calculate total prompt overhead
        this.promptTokens = this.personaPrompt.split(' ') + this.chatPrompt.split(' ').length + this.responsePrefix.split(' ').length;

        // Handle events from the LLM API
        this.ooba.on('message', (message) => {
            // A message has completed
            this.awaitingResponse = false;
            this.abortStream = false;
            logger.debug(`Received message from Oobabooga: ${message}`);
            this.responseStreamer.emitChunk();
            // insert a break in the file
            //this.responseOutputFile.receiveResponse('\n');
            //this._handleMessage(message);
        });
        this.ooba.on('token', (token) => {
            // Ooba is streaming tokens
            logger.debug(`Received token from Oobabooga: ${token}`);
            if (this.abortStream) return;
            // check if end of token is |, if so abort stream
            const endIdx = token.indexOf(this.chatDelimiter);
            const reachedDelimiter = endIdx > -1;
            if (reachedDelimiter) {
                token = token.substring(0, endIdx);
                this.abortStream = true;
            }
            if (!token) return;
            this.emit('token', token);
            this.responseStreamer.receiveToken(token);
            // if (reachedDelimiter) {
            //     this.abortStream = false;
            // }
        });

        // Handle events from the response streamer
        this.responseStreamer.on('chunk', (response) => {
            // A response has completed
            this._handleMessage(response);
        });
    }

    _handleMessage(message) {
        logger.debug(`Received message from ResponseStreamer: ${message}`);
        // Check if message is empty
        if (message.length === 0) {
            logger.warn(`Response is empty`);
            //return;
        }

        // Add response to response history
        let prevResponse = this.responseHistory[this.processingResponseID];
        if (prevResponse) {
            prevResponse += message;
        } else {
            prevResponse = message;
        }
        this.responseHistory[this.processingResponseID] = prevResponse;

        // Emit final response message for other services to consume
        this.emit('response', message);

        // Dequeue next response
        if (this.responseQueue.length > 0) {
            logger.debug(`Response queue is not empty, dequeuing next response`);
            const nextResponse = this.responseQueue.shift();
            this.processingResponseID = nextResponse[0];
            this._sendResponse(nextResponse[1]);
        }
    }

    getResponse(id) {
        return this.responseHistory[id];
    }

    addEventToHistory(event) {
        event = `*${this.persona.name} ${event}*`
        const response = this.responseHistory[this.lastResponseID];
        if (response) {
            this.responseHistory[this.lastResponseID] = `${response}\n${event}\n`;
        } else {
            this.responseHistory[this.lastResponseID] = event;
        }
    }

    sendResponse(messages, history) {
        // Generate a response prompt
        const prompt = this._generateResponsePrompt(messages, history);
        const dequeuedMessages = this.nextResponseID - this.lastResponseID;

        this.lastResponseID = this.nextResponseID;
        if (this.awaitingResponse) {
            logger.debug('Currently awaiting response, enqueuing response: ' + prompt);
            this.responseQueue.push([this.lastResponseID, prompt]);
        } else {
            logger.debug('Sending response: ' + prompt);
            this.processingResponseID = this.lastResponseID;
            this._sendResponse(prompt);
        }
        
        return dequeuedMessages;
    }

    _sendResponse(prompt) {
        this.ooba.send(prompt);
        this.awaitingResponse = true;
    }

    _generateResponsePrompt(messages, history) {
        const maxTokens = this.config.messages['max-tokens'] - this.promptTokens - 2;
        logger.debug(`max tokens remaining for chat: ${maxTokens}`);

        let tokens = 0;
        let dequeuedMessages = 0;
        let message, tokensPerMessage;
        // Add as many new messages as possible
        for (let i = 0; i < messages.length; i++) {
            message = messages[i];
            tokensPerMessage = this._addMessageToResponse(message, tokens, maxTokens);
            if (tokensPerMessage === -1) {
                logger.warn(`max tokens reached, unable to add enqueued message`);
                break;
            } else {
                tokens += tokensPerMessage;
                dequeuedMessages++;    
            }
        }
        // Add as many historical messages as possible
        for (let i = 0; i < history.length; i++) {
            message = history[i];
            tokensPerMessage = this._addMessageToResponse(message, tokens, maxTokens, true);
            if (tokensPerMessage === -1) {
                logger.warn(`max tokens reached, unable to add historical message`);
                break;
            } else {
                tokens += tokensPerMessage;
            }
        }

        this.nextResponseID = this.lastResponseID + dequeuedMessages;
        const chatHistory = this.responseBuffer.join('');
        logger.debug(`Chat history: ${chatHistory}`);
        const prompt = this.personaPrompt + this.chatPrompt 
                    + chatHistory + `\n${this.responsePrefix}`;
        logger.debug(`Used ${tokens} tokens to respond to ${this.responseBuffer.length} messages`);
        this.responseBuffer = [];
        return prompt;
    }

    _addMessageToResponse(msg, tokens, maxTokens, front=false) {
        logger.debug(`Adding message to response: ${msg.text}`)
        const txt = `${msg.username}: ${msg.text}${this.chatDelimiter}\n`;
        const tokensPerMessage = this._getTokensPerMessage(txt);
        if (tokens + tokensPerMessage > maxTokens) {
            logger.warn(`max tokens reached, unable to add enqueued message`);
            return -1;
        }
        if (front) {
            this.responseBuffer.unshift(txt);
        } else {
            this.responseBuffer.push(txt);
        }
        return tokensPerMessage;
    }
    
    _getTokensPerMessage(message) {
        return message.split(' ').length;
    }
}

module.exports = ResponseHandler;