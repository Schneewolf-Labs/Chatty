const EventEmitter = require('events');

// @emits message
class ChatServiceInterface extends EventEmitter {
    constructor() {
        super();
    }

    // Send a message to the chat service
    sendMessage(message) {
        throw new Error('sendMessage not implemented');
    }

    // Send an image to the chat service
    sendImage(image) {
        throw new Error('sendImage not implemented');
    }

    // Send a typing indicator to the chat service
    sendIsTyping() {
        throw new Error('sendIsTyping not implemented');
    }
}

module.exports = ChatServiceInterface;