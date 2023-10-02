const logger = require('../util/logger');
const EventEmitter = require('events');

// @emits message
class ChatServiceInterface extends EventEmitter {
    constructor() {
        super();
    }

    // Send a message to the chat service
    sendMessage(message) {
        logger.error(`sendMessage not implemented but got message: ${message}`);
        throw new Error('sendMessage not implemented');
    }

    // Send an image to the chat service
    sendImage(image) {
        logger.error(`sendImage not implemented but got image: ${image}`)
        throw new Error('sendImage not implemented');
    }

    // Send a typing indicator to the chat service
    sendTyping() {
        throw new Error('sendIsTyping not implemented');
    }
}

module.exports = ChatServiceInterface;