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
        this.responseHistory = {};
        this.lastResponseID = 0;
        this.messageQueue = [];
        this.promptQueue = [];

        // Receive replies from the AI
        this.ooba.on('message', (message) => {
            console.log(`Received message from Oobabooga: ${message}`);

            // Check the response didn't add hallucinated dialog
            const hallucinated = message.includes(this.persona.name+":");
            if (hallucinated) {
                console.warn(`Response from Oobabooga may contain hallucinated dialog`);
                // strip everything beyond the first message
                message = message.split('\n')[0];
                console.info(`Stripped message: ${message}`);
            }

            // Check for profanity
            if (this.options['reject-profanity'] && filter.isProfane(message)) {
                console.info(`rejected profane message from Oobabooga`);
                return;
            }
            // Check for negativity
            if (this.options['reject-negativity']) {
                const score = sentiment.analyze(message).score;
                const threshold = this.options['sentiment-threshold'];
                console.info(`sentiment score: ${score}`);
                if (score < threshold) {
                    console.info(`rejected negative (${score}) message from Oobabooga`);
                    return;
                }
            }

            // Add response to response history
            this.responseHistory[this.lastResponseID] = message;
            // Speak response if voice is enabled
            if (this.voiceHandler) {
                this.voiceHandler.speak(message);
            }
        });

        // Setup interval to flush message queue to AI
        setInterval(() => {
            const queueLength = this.messageQueue.length;
            console.log(`Message queue length: ${queueLength}`);
            // Exit if queue is empty or if the voice handler is busy speaking or if a message is being generated already
            if (queueLength == 0 || this.voiceHandler.is_speaking || this.ooba.recievingMessage) return;
            this.respondToChatFromMessageQueue();
        }, this.options['response-interval']);
    }

    receiveMessage(message) {
        console.log(`Received message from Twitch: ${message.text}`);
        // Check for profanity, if enabled
        if (this.options['reject-profanity'] && filter.isProfane(message.text)) {
            console.info(`rejected profane message from ${message.username}`);
            return;
        }
        // Check for negative sentiment, if enabled
        if (this.options['reject-negativity']) {
            const score = sentiment.analyze(message.text).score;
            const threshold = this.options['sentiment-threshold'];
            console.info(`sentiment score: ${score}`);
            if (score < threshold) {
                console.info(`rejected negative (${score}) message from ${message.username}`);
                return;
            }
        }
        // Check for a drawing trigger, if stable diffusion is enabled
        if (this.drawManager) {
            const prompt = this.drawManager.extractPrompt(message.text);
            if (prompt) {
                console.log(`Extracted drawing prompt: ${prompt}`);
                this.drawManager.draw(prompt);
                return;
            }
        }

        this.chatHistory.push(message);
        const id = this.chatHistory.length - 1;
        this.messageQueue.push(id);
    }

    respondToChatFromMessageQueue() {
        let text = '';
        const lowId = this.messageQueue[0];
        const lowerBound = Math.max(0, lowId - this.options['chat-history-length']);
        //const upperBound = Math.min(this.chatHistory.length, lowId + this.options['chat-max-batch-length']);
        // Add recent chat history to the prompt
        for (let i = lowerBound; i < lowId; i++) {
            const message = this.chatHistory[i];
            text += `${message.username}: ${message.text}\n`;
            if (this.responseHistory[i+1]) {
                text += `${this.persona.name}: ${this.responseHistory[i+1]}\n`;
            }
        }
        // Add enqueued messages to the prompt
        for (let i = 0; i < this.messageQueue.length; i++) {
            const id = this.messageQueue[i];
            const message = this.chatHistory[id];
            text += `${message.username}: ${message.text}\n`;
        }

        const prompt = this.persona.directive + "\n"
            + this.options['prompt'] + this.persona.name + "!\n"
            + text + `${this.persona.name}:`;
        
        this.ooba.send(prompt);
        this.messageQueue = [];
        this.lastResponseID = this.chatHistory.length;
    }

    setDrawManager(drawManager) {
        this.drawManager = drawManager;
    }

    setVoiceHandler(voiceHandler) {
        this.voiceHandler = voiceHandler;
    }

}

module.exports = MessageManager;