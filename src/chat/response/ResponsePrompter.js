const logger = require('../../util/logger');

class ResponsePrompter {
    constructor(config, persona, handler) {
        this.config = config;
        this.persona = persona;
        this.handler = handler;

        this.responseBuffer = [];

        // Setup prompts from the config
        this.personaPrompt = config.messages['persona-prompt'] + persona.directive + "\n";
        this.drawPrompt = this.handler.config.stable_diffusion.enabled ? this._replacePlaceholders(config.messages['draw-available-prompt']) : '';
        this.chatPrompt = this._replacePlaceholders(config.messages['prompt']) 
                        + this._replacePlaceholders(config.messages['safety-prompt'])
                        + this._replacePlaceholders(config.messages['limitations-prompt'])
                        + this.drawPrompt + config.messages['chat-history-prefix'];
        this.chatPrefix = config.messages['chat-prefix'];
        this.chatDelimiter = config.messages['chat-delimiter'];
        this.responsePrefix = this._replacePlaceholders(config.messages['prompt-response-prefix']);
        this.newChatPrefix = this._replacePlaceholders(config.messages['new-chat-prefix']);
        // Calculate total prompt overhead
        this.promptTokens = this.personaPrompt.split(' ').length + this.chatPrompt.split(' ').length + this.responsePrefix.split(' ').length + this.newChatPrefix.split(' ').length;
    }

    generatePrompt(messages, history) {
        const maxTokens = this.config.messages['max-tokens'] - this.promptTokens - 2;
        logger.debug(`max tokens remaining for chat: ${maxTokens}`);

        this.responseBuffer.push(this.newChatPrefix);
        let tokens = 0;
        let dequeuedMessages = 0;
        let message, tokensPerMessage;
        // Add as many new messages as possible
        for (let i = 0; i < messages.length; i++) {
            message = messages[i];
            tokensPerMessage = this._addMessageToPrompt(message, tokens, maxTokens);
            if (tokensPerMessage === -1) {
                logger.warn(`max tokens reached, unable to add enqueued message`);
                break;
            } else {
                tokens += tokensPerMessage;
                dequeuedMessages++;    
            }
        }
        // Add as many historical messages as possible
        let histMessagesAdded = 0;
        for (let i = history.length-1; i >= 0; i--) {
            message = history[i];
            tokensPerMessage = this._addMessageToPrompt(message, tokens, maxTokens, true);
            if (tokensPerMessage === -1) {
                logger.warn(`max tokens reached, unable to add historical message`);
                break;
            } else {
                tokens += tokensPerMessage;
                histMessagesAdded++;
            }
        }
        // reverse the order of just the added messages
        const reversed = this.responseBuffer.slice(0, histMessagesAdded).reverse();
        this.responseBuffer = reversed.concat(this.responseBuffer.slice(histMessagesAdded));
        // Add the persona prompt and response prefix
        const chatHistory = this.responseBuffer.join('');
        logger.debug(`Chat history: ${chatHistory}`);
        const prompt = this.personaPrompt + this.chatPrompt 
                    + chatHistory + `${this.responsePrefix}`;
        logger.debug(`Used ${tokens} tokens to respond to ${this.responseBuffer.length} messages`);
        this.responseBuffer = [];
        return {
            prompt,
            dequeuedMessages
        }
    }

    _addMessageToPrompt(msg, tokens, maxTokens, front=false) {
        if (!msg) {
            logger.warn(`attempted to add null message to prompt`);
            return -1;
        }
        logger.debug(`Adding message to response: ${msg.text}`)
        const txt = `${this.chatPrefix}${msg.author}\n${msg.text}${this.chatDelimiter}\n`;
        const tokensPerMessage = this._getTokensPerMessage(txt);
        if (tokens + tokensPerMessage > maxTokens) {
            logger.warn(`max tokens reached, unable to add enqueued message`);
            return -1;
        }
        if (front) {
            this.responseBuffer.unshift(txt);
        } else {
            this.responseBuffer.push(txt);
        }
        return tokensPerMessage;
    }
    
    _getTokensPerMessage(message) {
        return message.split(' ').length;
    }

    _replacePlaceholders(message) {
        message = this.persona.insertName(message);
        return message.replace('{DELIMITER}', this.chatDelimiter);
    }
}

module.exports = ResponsePrompter;