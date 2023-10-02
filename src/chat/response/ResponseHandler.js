const logger = require('../../util/logger');
const EventEmitter = require('events');
const OobaClient = require('../../client/OobaClient');
const ResponseStreamer = require('./ResponseStreamer');
const ResponsePrompter = require('./ResponsePrompter');

class ResponseHandler extends EventEmitter {
    constructor(config, persona) {
        super();
        this.config = config;
        this.ooba = new OobaClient(config.oobabooga);
        this.persona = persona;
        this.responseStreamer = new ResponseStreamer(config, this);
        this.responsePrompter = new ResponsePrompter(config, persona, this);

        this.responseQueue = [];
        this.responseHistory = {};
        this.lastResponseID = 0;
        this.nextResponseID = 0;
        this.processingResponseID = 0;
        this.awaitingResponse = false;

        // Handle events from the LLM API
        this.ooba.on('message', (message) => {
            // A message has completed
            this.awaitingResponse = false;
            this.abortStream = false;
            logger.debug(`Received message from Oobabooga: ${message}`);
            this.responseStreamer.emitChunk();
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

    addResponseToHistory(response) {
        // Add response to response history
        let prevResponse = this.responseHistory[this.lastResponseID];
        if (prevResponse) {
            prevResponse += ` ${response}`;
        } else {
            prevResponse = response;
        }
        this.responseHistory[this.lastResponseID] = prevResponse;
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
        const prompt = this.responsePrompter.generatePrompt(messages, history);
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

}

module.exports = ResponseHandler;