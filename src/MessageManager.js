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

        // Receive replies from the AI
        this.ooba.on('message', (message) => {
            console.log(`Received message from Oobabooga: ${message}`);
            if (this.voiceHandler) {
                this.voiceHandler.speak(message);
            }
        });

        // Setup interval to flush message queue to AI
        setInterval(() => {
            const queueLength = this.messageQueue.length;
            console.log(`Message queue length: ${queueLength}`);
            // Exit if queue is empty or if the voice handler is busy speaking
            if (queueLength == 0 || this.voiceHandler.is_speaking) return;
            this.respondToChatFromMessageQueue();
        }, this.options['response-interval']);
    }

    receiveMessage(message) {
        console.log(`Received message from Twitch: ${message.text}`);
        if (this.options.rejectProfane && filter.isProfane(message.text)) {
            console.info(`rejected profane message from ${message.username}`);
            return;
        }
        if (this.options.rejectNegativity) {
            const score = sentiment.analyze(message.text).score;
            const threshold = this.options['sentiment-threshold'];
            console.info(`sentiment score: ${score}`);
            if (score < threshold) {
                console.info(`rejected negative (${score}) message from ${message.username}`);
                return;
            }
        }

        this.chatHistory.push(message);
        const id = this.chatHistory.length - 1;
        this.messageQueue.push(id);
    }

    respondToChatFromMessageQueue() {
        let text = '';
        const lowId = this.messageQueue[0].id;
        const lowerBound = Math.max(0, lowId - this.options['chat-history-length']);
        // Add recent chat history to the prompt
        for (let i = lowId; i >= lowerBound; i--) {
            const message = this.chatHistory[i];
            text += `${message.username}: ${message.text}\n`;
        }
        // Add enqueued messages to the prompt
        for (let i = 0; i < this.messageQueue.length; i++) {
            const id = this.messageQueue[i];
            const message = this.chatHistory[id];
            text += `${message.username}: ${message.text}\n`;
        }

        const prompt = this.persona.directive + "\n"
            + this.options['prompt'] + "\n"
            + text + `\n${this.persona.name}:`;
        
        this.ooba.send(prompt);
        this.messageQueue = [];
    }

    setDrawManager(drawManager) {
        this.drawManager = drawManager;
    }

    setVoiceHandler(voiceHandler) {
        this.voiceHandler = voiceHandler;
    }

}

module.exports = MessageManager;