//const logger = require('./util/Logger');
const Persona = require('./util/Persona');
const Avatar = require('./util/Avatar');
const ChatHandler = require('./chat/ChatHandler');
const ChattyAPI = require('./api/ChattyAPI');
const ChatServiceInterface = require('./chat/ChatServiceInterface');

/**
 * Main class for Chatty
 */
class Chatty {
    /**
     * Creates a new Chatty instance
     * @param {Object} config - The configuration object following config.yaml
     */
    constructor(config) {
        this.config = config;
        this.persona = new Persona(config.persona_file);
        this.chatHandler = new ChatHandler(config, this.persona);

        this.avatar = null;
        if (config.avatar.enabled) {
            this.avatar = new Avatar(config.avatar.location);
        }

        this.api = null;
        if (config.api.enabled) {
            this.api = new ChattyAPI(this);
            this.api.start();
        }
    }

    /**
     * Add a chat service that Chatty will respond to
     * @param {ChatServiceInterface} service 
     */
    registerChatService(service) {
        this.chatHandler.registerChatService(service);
    }

    /**
     * Add a voice service (an implementation of ChatServiceInterface) that Chatty can use for TTS
     * @param {ChatServiceInterface} service
     */
    attachVoiceService(service) {
        this.chatHandler.registerChatService(service);
        this.chatHandler.setVoiceService(service);
    }
}

module.exports = Chatty;