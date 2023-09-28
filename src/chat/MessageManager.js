const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const MessageSanitizer = require('./MessageSanitizer');

class MessageManager extends EventEmitter {
    constructor(ooba, persona, options) {
        super();
        this.ooba = ooba;
        this.persona = persona;
        this.options = options;
        this.drawManager = null;
        this.voiceHandler = null;

        this.chatPrompt = persona.insertName(this.options['prompt']) + persona.insertName(this.options['safety-prompt']);
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
        this.sanitizer = new MessageSanitizer(this.options);

        // Receive replies from the AI
        this.ooba.on('message', (message) => {
            this.awaitingResponse = false;
            this._handleMessage(message);
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
        console.log(`MessageManager got: ${message.text}`);
        const isProfane = this.sanitizer.shouldReject(message.text);
        if (isProfane) {
            console.info(`rejected message from ${message.username}`);
            return;
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

    _handleMessage(message) {
        console.log(`Received message from Oobabooga: ${message}`);
        message = this.sanitizer.trimResponse(message);
        message = this.sanitizer.sanitize(message);
        // Check if message is empty
        if (message.length === 0) {
            console.warn(`Response from Oobabooga is empty`);
            return;
        }

        // Check if the message should be rejected
        if (this.sanitizer.shouldReject(message)) {
            console.warn(`Response from Oobabooga was rejected`);
            // Replace the profane message and remove the response from the speech output buffer
            message = this.options['profanity-replacement'];
            this.speechBuffer = message;
            //return;
        }

        // Add response to response history
        this.responseHistory[this.lastResponseID] = message;
        // Speak response if voice is enabled
        this._dumpSpeechBuffer();
        // Set response output to expire
        const thisId = this.lastResponseID;
        // Emit final response message for other services to consume
        this.emit('response', message);
        
        // Set a timeout to clear the response output file
        // XXX: this should be an interval that can retry when it is blocked
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