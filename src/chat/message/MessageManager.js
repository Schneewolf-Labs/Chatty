const logger = require('../../util/logger');
const EventEmitter = require('events');

class MessageManager extends EventEmitter {
    constructor(options, responseHandler) {
        super();
        this.options = options;
        this.responseHandler = responseHandler;
        this.drawManager = null;
        this.voiceService = null;

        this.chatHistory = [];
        this.messageQueue = [];

        // Setup interval to respond to message queue
        setInterval(() => {
            const queueLength = this.messageQueue.length;
            logger.debug(`Message queue length: ${queueLength}`);
            // Exit if queue is empty or voice service is speaking
            const isSpeaking = this.voiceService && this.voiceService.isBlocking();
            if (isSpeaking) logger.debug(`Voice service is speaking, skipping response`);
            if (queueLength == 0 || isSpeaking) return;
            this.respondToChatFromMessageQueue();
        }, this.options['response-interval']);
    }

    receiveMessage(message) {
        logger.debug(`MessageManager got: ${message.text}`);
        
        // Check for a drawing trigger, if stable diffusion is enabled
        if (this.drawManager) {
            const prompt = this.drawManager.extractPrompt(message.text);
            if (prompt) {
                logger.debug(`Extracted drawing prompt: ${prompt}`);
                this.drawManager.draw(prompt);
                //return;
            }
        }

        this.chatHistory.push(message);
        const id = this.chatHistory.length - 1;
        this.messageQueue.push(id);
    }

    respondToChatFromMessageQueue() {
        const messages = [];
        const history = [];
        
        const lowId = this.messageQueue[0]; // first id of messages we want to respond to
        const lowerBound = Math.max(0, lowId - this.options['chat-history-length']); // lowest chat id we will show in history
        const upperBound = Math.min(this.chatHistory.length, lowId + this.options['chat-max-batch-size']); // highest chat id we will show in history
        logger.debug(`lowID: ${lowId}, lowerBound: ${lowerBound}, upperBound: ${upperBound}`);

        // Add enqueued messages
        for (let i = lowId; i < upperBound; i++) {
            const message = this.chatHistory[i];
            messages.push(message);
        }
        // Add chat history to the prompt
        const includeResponses = this.options['include-responses-in-history'];
        for (let i = lowId-1; i >= lowerBound; i--) {
            // Add the AI's own responses to the history
            const historicalResponse = this.responseHandler.getResponse(i+1);
            if (includeResponses && historicalResponse) {
                history.push({
                    author: this.responseHandler.persona.name,
                    text: historicalResponse
                });
            }
            history.push(this.chatHistory[i]);
        }

        // Send response
        const dequeuedMessages = this.responseHandler.sendResponse(messages, history);

        // Dequeue messages
        logger.debug(`dequeuing ${dequeuedMessages} messages from message queue`);
        this.messageQueue = this.messageQueue.slice(dequeuedMessages);
    }

    setDrawManager(drawManager) {
        this.drawManager = drawManager;
        this.drawManager.on('image', () => {
            this.responseHandler.addEventToHistory('posted a drawing');
        });
    }

    setVoiceService(voiceService) {
        this.voiceService = voiceService;
    }
}

module.exports = MessageManager;