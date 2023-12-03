const logger = require('../../util/logger');
const EventEmitter = require('events');
const Buffer = require('buffer').Buffer;

class MessageManager extends EventEmitter {
    constructor(options, chatChannel) {
        super();
        this.options = options;
        this.chatChannel = chatChannel;
        this.drawManager = null;
        this.voiceService = null;

        this.chatHistory = [];
        this.messageQueue = [];

        this.blockOnProcessing = options['block-while-processing-attachments'];
        this.processing = false; // TODO: implement this on a per-message basis

        // Setup interval to respond to message queue
        setInterval(() => {
            //const queueLength = this.messageQueue.length;
            //logger.debug(`Message queue length: ${queueLength}`);
            this.respondToChatFromMessageQueue();
        }, this.options['response-interval']);
    }

    receiveMessage(message) {
        logger.debug(`MessageManager got: ${message.text}`);
        
        // TODO: message parsing can be its own class
        // Check for a drawing trigger, if stable diffusion is enabled
        if (this.drawManager) {
            // check for image attachments
            if (message.attachments.length > 0) {
                // TODO: handle multiple attachments
                const attachment = message.attachments[0];
                const url = attachment.url;
                logger.debug(`Got image attachment: ${url}`);
                // Download image from url
                fetch(url).then(res => {
                    if (res.ok) {
                        logger.debug(`Downloaded image from ${url}`);
                        return res.arrayBuffer();
                    } else {
                        logger.error(`Could not download image from ${url}: ${res.status} ${res.statusText}`);
                    }
                }).then(buffer => {
                    // Convert arraybuffer to base64
                    const base64 = Buffer.from(buffer).toString('base64');
                    attachment.data = base64;
                    // Send image to draw manager
                    this.drawManager.caption(attachment);
                });
                this.processing = true;
            }

            const prompt = this.drawManager.extractPrompt(message.text);
            if (prompt) {
                // TODO: if there's a prompt and an image attachment, we should use img2img
                logger.debug(`Extracted drawing prompt: ${prompt}`);
                const enqueued = this.drawManager.draw(prompt, message.channel);
                if (!enqueued) { // drawing was rejected, let the user know
                    this.chatChannel.sendResponse(this.drawManager.settings.rejected_response, message.channel);
                    return;
                }
            }
        }
        // Push message to the chat history
        this.chatHistory.push(message);

        // If the message text is empty, disregard it at this point
        if (!message.getText()) return;
        // Check for a wake word in the message
        const wakewords = this.options['wake-words'];
        const containsWakeword = wakewords.some((word) => {
            return message.text.toLowerCase().includes(word.toLowerCase());
        });
        if (containsWakeword) {
            // mark this message to be directly replied to
            message.directReply = true;
        }

        // Add message to message queue
        const id = this.chatHistory.length - 1;
        this.messageQueue.push(id);
        if (this.options['prune-history']) this.pruneHistory();

        // force a response to the message queue if directly mentioned
        if (containsWakeword) this.respondToChatFromMessageQueue();
    }

    respondToChatFromMessageQueue() {
        // Exit if queue is empty, voice service is speaking, or processing attachments
        const queueLength = this.messageQueue.length;
        if (queueLength == 0) {
            logger.debug('Message queue is empty, skipping response');
            return;
        }
        const isSpeaking = this.voiceService && this.voiceService.isBlocking();
        if (isSpeaking) {
            logger.debug(`Voice service is speaking, skipping response`);
            return;
        }
        const processingBlock = this.processing && this.blockOnProcessing;
        if (processingBlock) {
            logger.debug(`Message manager is processing attachments, skipping response`);
            return;
        }

        const messages = [];
        const history = [];
        
        const lowId = this.messageQueue[0]; // first id of messages we want to respond to
        const lowerBound = Math.max(0, lowId - this.options['chat-history-length']); // lowest chat id we will show in history
        const upperBound = Math.min(this.chatHistory.length, lowId + this.options['chat-max-batch-size']); // highest chat id we will show in history
        logger.debug(`lowID: ${lowId}, lowerBound: ${lowerBound}, upperBound: ${upperBound}`);

        let directlyMentioned = false;
        // Add enqueued messages
        for (let i = lowId; i < upperBound; i++) {
            const message = this.chatHistory[i];
            messages.push(message);
            if (message.directReply) directlyMentioned = true;
        }
        // Add chat history to the prompt
        const includeResponses = this.options['include-responses-in-history'];
        for (let i = lowId-1; i >= lowerBound; i--) {
            // Add the AI's own responses to the history
            const historicalResponse = this.chatChannel.getResponse(i+1);
            if (includeResponses && historicalResponse) {
                history.push({
                    author: this.chatChannel.responseHandler.persona.name,
                    text: historicalResponse,
                    getText: () => { return historicalResponse; }
                });
            }
            // Add the historical messages from users
            history.push(this.chatHistory[i]);
        }

        // Check if we should actually respond to this batch
        let dequeuedMessages = messages.length;
        const selectiveResponses = this.options['selective-responses'];
        let shouldRespond = directlyMentioned || !selectiveResponses; // respond if directly mentioned or if selective responses are disabled
        if (!shouldRespond && selectiveResponses) {
            // TODO augment response chance with factors besides time since last response
            let responseChance = this._calculateResponseChance();
            shouldRespond = responseChance > Math.random(); // respond if random chance is greater than response chance
            logger.debug(`response chance: ${responseChance}%`);
        }
        if (this.options['require-wake-word']) shouldRespond = directlyMentioned; // if wake word is required, only respond if directly mentioned

        // Send response
        if (shouldRespond) {
            logger.debug('Enqueuing response to message queue');
            dequeuedMessages = this.chatChannel.enqueueResponse(messages, history);
        } else {
            logger.debug('Not enqueuing response to message queue');
        }

        // Update last response id
        const lastResponseID = lowId + dequeuedMessages;
        logger.debug(`updating last response id to ${lastResponseID}`);
        this.chatChannel.updateLastResponseID(lastResponseID);

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
        this.drawManager.on('caption', (attachment) => {
            this.processing = false;
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

    _calculateResponseChance() {
        const currentTime = new Date();
        // Convert the difference to seconds
        const elapsedTime = (currentTime - this.chatChannel.lastResponseTime) / 1000; 
        logger.debug(`elapsed time since last response: ${elapsedTime}`);
    
        const baseChance = this.options['base-response-chance'];
        const maxChance = this.options['max-response-chance'];
        const timeFactor = Math.log(elapsedTime + 1);
        let chance = baseChance + (maxChance - baseChance) * timeFactor / 10;
    
        chance = Math.min(1.0, Math.max(0.0, chance));
        return chance;
    }
}

module.exports = MessageManager;