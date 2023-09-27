const fs = require('fs');
const path = require('path');
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

        this.chatPrompt = persona.insertName(this.options['prompt']);
        this.responsePrefix = persona.insertName(this.options['prompt-response-prefix']);
        this.promptTokens = this.chatPrompt.split(' ').length;

        const output_location = this.ooba.settings.output_location;
        this.responseFile = path.join(process.cwd(), output_location);

        this.chatHistory = [];
        this.responseHistory = {};
        this.lastResponseID = 0;
        this.messageQueue = [];
        this.promptQueue = [];
        this.speechBuffer = '';
        this.awaitingResponse = false;

        // Receive replies from the AI
        this.ooba.on('message', (message) => {
            this.awaitingResponse = false;
            console.log(`Received message from Oobabooga: ${message}`);

            // End response before first \"
            const end = message.indexOf('\"');
            if (end > 0) message = message.substring(0, end);
            // Strip any trailing whitespace
            message = message.trim();
            // Check if message is empty
            if (message.length === 0) {
                console.warn(`Response from Oobabooga is empty`);
                return;
            }

            // Check for profanity
            if (this.options['reject-profanity'] && filter.isProfane(message)) {
                console.info(`rejected profane message from Oobabooga`);
                message = this.options['profanity-replacement'];
                this.speechBuffer = message;
                //return;
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

            // Strip any URLs from the message
            message = message.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '');
            // Strip things contained in [] brackets
            message = message.replace(/\[.*?\]/g, '');

            // Check if message is now empty
            if (message.length === 0) {
                console.warn(`Response from Oobabooga is empty`);
                return;
            }

            // Add response to response history
            this.responseHistory[this.lastResponseID] = message;
            // Speak response if voice is enabled
            this._dumpSpeechBuffer();
            // Set response output to expire
            const thisId = this.lastResponseID;
            setTimeout((lastId) => {
                // Check if another response has been received since this one
                if (lastId != this.lastResponseID) return;
                // Check if another response is already being written
                if (this.awaitingResponse) return;
                // Check if voice handler is enabled and is speaking
                if (this.voiceHandler && this.voiceHandler.is_speaking) return;
                // Clear output file
                console.info(`Response output expired, clearing file`);
                this._clearResponseOutput();
            }, this.options['response-expire-time'], thisId);
        });
        
        this.ooba.on('token', (token) => {
            //console.log(`Received token from Oobabooga: ${token}`);
            // check if end of token is \"
            const end = token.indexOf('\"');
            if (end > 0) token = token.substring(0, end);
            if (!token) return;
            this._pushSpeechToken(token);
            this._streamTokenToResponseOutput(token);
        });

        // Setup interval to flush message queue to AI
        setInterval(() => {
            const queueLength = this.messageQueue.length;
            //console.log(`Message queue length: ${queueLength}`);
            // Exit if queue is empty, we are awaiting a response, or the voice handler is speaking
            if (queueLength == 0 || this.awaitingResponse || this.voiceHandler.is_speaking) return;
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
                //return;
            }
        }

        this.chatHistory.push(message);
        const id = this.chatHistory.length - 1;
        this.messageQueue.push(id);
    }

    respondToChatFromMessageQueue() {
        const directiveTokens = this.persona.numTokens;
        const maxTokens = this.options['max-tokens'] - directiveTokens - this.promptTokens - 2;
        console.info(`max tokens remaining for chat: ${maxTokens}`);
        
        let messages = [];
        let tokens = 0;
        let dequeuedMessages = 0;
        const lowId = this.messageQueue[0]; // first id of messages we want to respond to
        const lowerBound = Math.max(0, lowId - this.options['chat-history-length']); // lowest chat id we will show in history
        const upperBound = Math.min(this.chatHistory.length, lowId + this.options['chat-max-batch-size']); // highest chat id we will show in history
        //console.info(`lowID: ${lowId}, lowerBound: ${lowerBound}, upperBound: ${upperBound}`);

        let txt, tokensPerMessage;
        // Add enqueued messages to the prompt
        for (let i = lowId; i < upperBound; i++) {
            const message = this.chatHistory[i];
            txt = `${message.username}: ${message.text}\n`;
            tokensPerMessage = this._getTokensPerMessage(txt);
            if (tokens + tokensPerMessage > maxTokens) {
                console.warn(`max tokens reached, unable to add enqueued message`);
                break;
            }
            messages.push(txt);
            tokens += tokensPerMessage;
            dequeuedMessages++;
        }
        // Add chat history to the prompt
        for (let i = lowId-1; i >= lowerBound; i--) {
            // Add the AI's own responses to the history
            if (this.responseHistory[i+1]) {
                txt = `${this.persona.name}: ${this.responseHistory[i+1]}\n`;
                tokensPerMessage = this._getTokensPerMessage(txt);
                if (tokens + tokensPerMessage > maxTokens) {
                    console.warn(`max tokens reached, unable to add historical response`);
                    break;
                }
                messages.unshift(txt);
                tokens += tokensPerMessage;
            }

            const message = this.chatHistory[i];
            txt = `${message.username}: ${message.text}\n`;
            tokensPerMessage = this._getTokensPerMessage(txt);
            if (tokens + tokensPerMessage > maxTokens) {
                console.warn(`max tokens reached, unable to add chat history`);
                break;
            }
            messages.unshift(txt);
            tokens += tokensPerMessage;
        }

        const prompt = this.persona.directive + "\n"
            + this.chatPrompt + messages.join('') + `\n${this.responsePrefix}`;
        
        this.ooba.send(prompt);
        console.log(`Used ${tokens} tokens to respond to ${messages.length} messages`);
        // Dequeue messages
        console.log(`dequeuing ${dequeuedMessages} messages from message queue`);
        this.messageQueue = this.messageQueue.slice(dequeuedMessages);
        this.lastResponseID = lowId + dequeuedMessages;
        this.awaitingResponse = true;
        this._clearResponseOutput();
    }

    setDrawManager(drawManager) {
        this.drawManager = drawManager;
    }

    setVoiceHandler(voiceHandler) {
        this.voiceHandler = voiceHandler;
    }

    _getTokensPerMessage(message) {
        return message.split(' ').length;
    }

    _clearResponseOutput() {
        fs.writeFileSync(this.responseFile, '', 'utf8');
    }

    _streamTokenToResponseOutput(token) {
        fs.appendFileSync(this.responseFile, token, 'utf8');
    }

    _pushSpeechToken(token, speak = false) {
        if (this.voiceHandler) {
            const streamSpeech = this.voiceHandler.options['stream_speech'];
            this.speechBuffer += token;
            // if token contains punctuation, or newlines, or is a single character, dump the buffer
            if ((streamSpeech || speak) && (token.includes('.') || token.includes(',') || token.includes('\n'))) {
                this._dumpSpeechBuffer();
            }
        }
    }

    _dumpSpeechBuffer() {
        if (this.voiceHandler) {
            this.voiceHandler.speak(this.speechBuffer);
            this.speechBuffer = '';
        }
    }
}

module.exports = MessageManager;