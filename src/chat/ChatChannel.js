const logger = require('../util/logger');
const EventEmitter = require('events');
const MessageManager = require('./message/MessageManager');

class ChatChannel extends EventEmitter {
    constructor(channelID, config, ooba, responseHandler) {
        super();
        this.channelID = channelID;
        this.config = config;
        this.ooba = ooba;
        this.responseHandler = responseHandler;
        this.messageManager = new MessageManager(config.messages, this);

        this.responseHandler.addChannel(this);
        this.responseHandler.on('response', (response) => {
            logger.debug(`response channel: ${response.channel}, this channel: ${this.channelID}`);
            // check if this response is for this channel
            if (response.channel !== this.channelID) return;
            this.emit('response', response);
        });
        this.responseHandler.on('token', (token) => {
            logger.debug(`token channel: ${token.channel}, this channel: ${this.channelID}`);
            if (token.channel !== this.channelID) return;
            this.emit('token', token);
        });

        logger.info(`Created chat channel ${channelID}`);
    }

    sendResponse(message, channel) {
        this.responseHandler.emitResponse(message, channel);
    }

    enqueueResponse(messages, history) {
        return this.responseHandler.sendResponse(messages, history, this.channelID);
    }

    addEventToHistory(event) {
        this.responseHandler.addEventToHistory(event, this.channelID);
    }

    getResponse(id) {
        return this.responseHandler.getResponse(id, this.channelID);
    }

    setDrawManager(drawManager) {
        this.messageManager.setDrawManager(drawManager);
    }

    setVoiceService(voiceService) {
        this.messageManager.setVoiceService(voiceService);
    }
}

module.exports = ChatChannel;