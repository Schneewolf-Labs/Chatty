const logger = require('../../util/logger');
const EventEmitter = require('events');
const ResponseStreamer = require('./ResponseStreamer');
const ResponsePrompter = require('./ResponsePrompter');
const ResponseHistory = require('./ResponseHistory');
const ChatMessage = require('../message/ChatMessage');
const ResponseToken = require('./ResponseToken');
const RepetitionDetector = require('../../util/RepetitionDetector');

class ResponseHandler extends EventEmitter {
    constructor(config, ooba, persona) {
        super();
        this.config = config;
        this.ooba = ooba;
        this.persona = persona;
        this.responseStreamer = new ResponseStreamer(config, this, this.ooba);
        this.responsePrompter = new ResponsePrompter(config, persona, this);
        this.repetitionDetector = new RepetitionDetector(config.messages['repetition-threshold'], config.messages['chat-history-length']/2);

        this.responseQueue = [];
        this.histories = {};
        this.awaitingResponse = false;
        this.currentChannel = null;
        this.throttleHistory = false;

        // Handle events from the response streamer
        this.responseStreamer.on('chunk', (response) => {
            // A response has completed
            this._handleMessage(response);
        });
        this.responseStreamer.on('token', (token) => {
            const resToken = new ResponseToken(token, this.currentChannel);
            this.emit('token', resToken);
        });
    }

    _handleMessage(message) {
        logger.debug(`Received message from ResponseStreamer: ${message}`);
        this.awaitingResponse = false;
        // Check if message is empty
        if (message.length === 0) {
            logger.warn(`Response is empty`);
        }

        // Check if message is repetitive
        let shouldRespond = true;
        if (this.config.messages['block-repetitive-responses']) {
            const isRepetitive = this.repetitionDetector.isRepetitive(message, this.getHistory(this.currentChannel));
            if (isRepetitive) {
                logger.warn(`Response is repetitive, blocking`);
                this.responseStreamer.abort();
                shouldRespond = false;
                if (this.config.messages['throttle-history-on-repetitive-response']) {
                    this.throttleHistory = true;
                }
            }
        }

        // Emit final response message for other services to consume
        if (shouldRespond) this.emitResponse(message, this.currentChannel);

        // Dequeue next response
        if (this.responseQueue.length > 0) {
            logger.debug(`Response queue is not empty, dequeuing next response`);
            const nextResponse = this.responseQueue.shift();
            this.currentChannel = nextResponse.channel;
            this._sendResponse(nextResponse.prompt);
        }
    }

    addChannel(channel) {
        const channelID = channel.channelID;
        this.histories[channelID] = new ResponseHistory(this.persona);
        logger.debug(`Added channel ${channelID} to response handler`);
    }

    updateLastResponseID(id, channel) {
        const history = this.getHistory(channel);
        history.setLastResponseID(id);
    }

    getHistory(channel) {
        return this.histories[channel];
    }

    getResponse(id, channel) {
        const history = this.histories[channel];
        return history.getResponse(id);
    }

    addResponseToHistory(response, channel) {
        logger.debug(`Adding response to history: ${response} for channel ${channel}`);
        const history = this.histories[channel];
        history.addResponse(response);
    }

    addEventToHistory(event, channel) {
        const history = this.histories[channel];
        history.addEvent(event);
    }

    emitResponse(response, channel) {
        // Package in ChatMessage format
        const message = new ChatMessage(this.persona.name, response);
        message.channel = channel;
        this.emit('response', message);
    }

    sendResponse(messages, history, channel) {
        // Get History
        const channelHist = this.histories[channel];
        // Check if chat history should be throttled
        if (this.throttleHistory) {
            logger.debug(`Throttling history for channel ${channel}`);
            history = [];
            this.throttleHistory = false;
        }
        // Generate a response prompt
        const { prompt, dequeuedMessages } = this.responsePrompter.generatePrompt(messages, history);

        //channelHist.lastResponseID = channelHist.lastResponseID + dequeuedMessages;

        if (this.awaitingResponse) {
            logger.debug('Currently awaiting response, enqueuing response: ' + prompt);
            const resQueueItem = {
                id: channelHist.lastResponseID,
                prompt: prompt,
                channel: channel
            }
            this.responseQueue.push(resQueueItem);
        } else {
            logger.debug('Sending response: ' + prompt);
            this.currentChannel = channel;
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