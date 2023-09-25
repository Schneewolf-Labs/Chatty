const badwords = require('bad-words');
const filter = new badwords();
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

class MessageManager {
    constructor(ooba, persona, options) {
        this.ooba = ooba;
        this.persona = persona;
        this.options = options;
        this.drawManager = null;
        this.voiceHandler = null;

        this.chatHistory = [];
        this.messageQueue = [];
        this.promptQueue = [];

        this.ooba.on('message', (message) => {
            console.log(`Received message from Oobabooga: ${message}`);
        });
    }

    receiveMessage(message) {
        if (this.options.rejectProfane && filter.isProfane(message.text)) {
            console.info(`rejected profane message from ${message.username}`);
        }
        //if (sentiment.analyze(message.text).score < this.options['sentimentThreshold']) {];

        this.chatHistory.push(message);
        const id = this.chatHistory.length - 1;
        this.messageQueue.push(id);
    }

    setDrawManager(drawManager) {
        this.drawManager = drawManager;
    }

    setVoiceHandler(voiceHandler) {
        this.voiceHandler = voiceHandler;
    }

}

module.exports = MessageManager;