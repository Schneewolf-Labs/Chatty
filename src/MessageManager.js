class MessageManager {
    constructor(ooba, persona) {
        this.ooba = ooba;
        this.persona = persona;
        this.stableDiffusionClient = null;
        this.voiceHandler = null;

        this.chatHistory = [];
        this.messageQueue = [];
        this.promptQueue = [];
    }

    setStableDiffusionClient(stableDiffusionClient) {
        this.stableDiffusionClient = stableDiffusionClient;
    }

    setVoiceHandler(voiceHandler) {
        this.voiceHandler = voiceHandler;
    }

}

module.exports = MessageManager;