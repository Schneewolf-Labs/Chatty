const logger = require('../../util/logger');
const EventEmitter = require('events');

class MessageManager extends EventEmitter {
    constructor(options, chatChannel) {
        super();
        this.options = options;
        this.chatChannel = chatChannel;
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
        
        // TODO: message parsing can be its own class
        // Check for a drawing trigger, if stable diffusion is enabled
        if (this.drawManager) {
            const prompt = this.drawManager.extractPrompt(message.text);
            if (prompt) {
                logger.debug(`Extracted drawing prompt: ${prompt}`);
                const enqueued = this.drawManager.draw(prompt);
                if (!enqueued) { // drawing was rejected, let the user know
                    this.chatChannel.sendResponse(this.drawManager.settings.rejected_response, message.channel);
                    return;
                }
            }
        }
        // Check for a wake word in the message
        const wakewords = this.options['wake-words'];
        const containsWakeword = wakewords.some((word) => {
            return message.text.toLowerCase().includes(word.toLowerCase());
        });
        if (containsWakeword) {
            // mark this message to be directly replied to
            message.directReply = true;
        }

        this.chatHistory.push(message);
        const id = this.chatHistory.length - 1;
        this.messageQueue.push(id);
        if (this.options['prune-history']) this.pruneHistory();
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
            const historicalResponse = this.chatChannel.getResponse(i+1);
            if (includeResponses && historicalResponse) {
                history.push({
                    author: this.chatChannel.responseHandler.persona.name,
                    text: historicalResponse
                });
            }
            history.push(this.chatHistory[i]);
        }

        // Send response
        const dequeuedMessages = this.chatChannel.enqueueResponse(messages, history);

        // Dequeue messages
        logger.debug(`dequeuing ${dequeuedMessages} messages from message queue`);
        this.messageQueue = this.messageQueue.slice(dequeuedMessages);
    }

    setDrawManager(drawManager) {
        this.drawManager = drawManager;
        if (!this.drawManager) return;
        this.drawManager.on('prompt', (prompt) => {
            this.chatChannel.addEventToHistory(`enqueued drawing of ${prompt}`);
        });
        this.drawManager.on('image', (image) => {
            this.chatChannel.addEventToHistory(`drew ${image.prompt}`);
        });
    }

    setVoiceService(voiceService) {
        this.voiceService = voiceService;
    }

    pruneHistory() {
        const historyLength = this.chatHistory.length;
        const maxLength = this.options['chat-history-length'];
        // Check if we need to prune
        if (historyLength <= maxLength) return;
        logger.debug(`Pruning chat history from ${historyLength} to ${maxLength}`);
        // Prune chat history
        //this.chatHistory = this.chatHistory.slice(-maxLength);
        for (let i = historyLength - maxLength - 1; i > 0; i--) {
            if (!this.chatHistory[i]) break; // don't delete messages that have already been deleted
            delete this.chatHistory[i];
        }
        // TODO: also prune response history
        //this.chatChannel.responseHandler.histories[this.chatChannel.channelID].pruneResponses();
    }
}

module.exports = MessageManager;