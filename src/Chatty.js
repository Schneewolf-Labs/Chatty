//const logger = require('./util/Logger');
const Persona = require('./util/Persona');
const ChatHandler = require('./chat/ChatHandler');
const ChattyAPI = require('./api/ChattyAPI');

class Chatty {
    constructor(config) {
        this.config = config;
        this.persona = new Persona(config.persona_file);
        this.chatHandler = new ChatHandler(config, this.persona);

        this.api = null;
        if (config.api.enabled) {
            this.api = new ChattyAPI(this);
            this.api.start();
        }
    }

    registerChatService(service) {
        this.chatHandler.registerChatService(service);
    }

    attachVoiceService(service) {
        this.chatHandler.registerChatService(service);
        this.chatHandler.messageManager.setVoiceService(service);
    }
}

module.exports = Chatty;