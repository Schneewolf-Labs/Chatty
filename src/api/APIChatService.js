const ChatServiceInterface = require('../chat/ChatServiceInterface');

class APIChatService extends ChatServiceInterface {
    constructor(api) {
        super();
        this.api = api;
    }

    sendMessage(message) {
        // send message to api user
        this.api.broadcastMessage(message);
    }

    sendImage(image) {
        // send image to api user
        this.api.broadcastImage(image);
    }

    sendTyping() {
        // send typing indicator to api user
        this.api.broadcastTyping();
    }
}

module.exports = APIChatService;