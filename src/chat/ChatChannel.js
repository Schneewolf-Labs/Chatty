const logger = require('../util/logger');
const EventEmitter = require('events');
const ResponseHandler = require('./response/ResponseHandler');
const MessageManager = require('./message/MessageManager');

class ChatChannel extends EventEmitter {
    constructor(channelID, config, ooba, persona) {
        super();
        this.channelID = channelID;
        this.config = config;
        this.ooba = ooba;
        this.responseHandler = new ResponseHandler(config, ooba, persona);
        this.messageManager = new MessageManager(config.messages, this.responseHandler);

        this.responseHandler.on('response', (response) => {
            this.emit('response', response);
        });
        this.responseHandler.on('token', (token) => {
            this.emit('token', token);
        });

        logger.info(`Created chat channel ${channelID}`);
    }

    setDrawManager(drawManager) {
        this.messageManager.setDrawManager(drawManager);
    }

    setVoiceService(voiceService) {
        this.messageManager.setVoiceService(voiceService);
    }
}

module.exports = ChatChannel;