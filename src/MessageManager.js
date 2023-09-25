class MessageManager {
    constructor(ooba, persona) {
        this.ooba = ooba;
        this.persona = persona;
        this.drawManager = null;
        this.voiceHandler = null;

        this.chatHistory = [];
        this.messageQueue = [];
        this.promptQueue = [];
    }

    setDrawManager(drawManager) {
        this.drawManager = drawManager;
    }

    setVoiceHandler(voiceHandler) {
        this.voiceHandler = voiceHandler;
    }

}

module.exports = MessageManager;