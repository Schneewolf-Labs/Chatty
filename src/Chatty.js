const logger = require('./util/Logger');
const Persona = require('./util/Persona');
const ChatHandler = require('./chat/ChatHandler');

class Chatty {
    constructor(config) {
        this.config = config;
        this.persona = new Persona(config.persona_file);
        this.chatHandler = new ChatHandler(config, this.persona);
    }

    registerChatService(service) {
        this.chatHandler.registerChatService(service);
    }
}

module.exports = Chatty;