const logger = require('../util/Logger');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const OobaClient = require('../client/OobaClient');

class ResponseHandler extends EventEmitter {
    constructor(config, persona) {
        super();
        this.config = config;
        this.ooba = new OobaClient(config.oobabooga);
        this.persona = persona;

        this.responseHistory = {};
        this.lastResponseID = 0;
        this.nextResponseID = 0;
        this.awaitingResponse = false;
        this.abortStream = false;
        this.responseBuffer = [];

        // Setup prompts from the config
        this.chatPrompt = persona.insertName(config.messages['prompt']) + persona.insertName(config.messages['safety-prompt']);
        this.responsePrefix = persona.insertName(config.messages['prompt-response-prefix']);
        this.promptTokens = this.chatPrompt.split(' ').length;
        this.chatDelimiter = config.messages['chat-delimiter'];

        // Handle events from the LLM API
        this.ooba.on('message', (message) => {
            // A message has completed
            this.awaitingResponse = false;
            this.abortStream = false;
            this._handleMessage(message);
        });
        this.ooba.on('token', (token) => {
            // Ooba is streaming tokens
            logger.debug(`Received token from Oobabooga: ${token}`);
            if (this.abortStream) return;
            // check if end of token is \"
            const end = token.indexOf('\"');
            const reachedSpeechDelimiter = end > 0;
            if (reachedSpeechDelimiter){
                token = token.substring(0, end);
                this.abortStream = true;
            }
            if (!token) return;
            // XXX: profane response may end up being streamed to outputs
            this._pushSpeechToken(token);
            this._streamTokenToResponseOutput(token);
        });

        // If using Windows and voice is enabled, initialize voice synthesis
        this.voiceHandler = null;
        this.speechBuffer = '';
        if (process.platform === 'win32' && config.voice.enabled === true) {
            const VoiceHandler = require('../tts/VoiceHandler');
            const voiceHandler = new VoiceHandler(config.voice);
            this.voiceHandler = voiceHandler;
        }

        // Response Output
        const output_location = this.ooba.settings.output_location;
        this.responseFile = path.join(process.cwd(), output_location);
    }

    _handleMessage(message) {
        logger.debug(`Received message from Oobabooga: ${message}`);
        //message = this.sanitizer.trimResponse(message);
        //message = this.sanitizer.sanitize(message);
        // Check if message is empty
        if (message.length === 0) {
            logger.warn(`Response from Oobabooga is empty`);
            return;
        }

        // Check if the message should be rejected
        // if (this.sanitizer.shouldReject(message)) {
        //     logger.warn(`Response from Oobabooga was rejected`);
        //     // Replace the profane message and remove the response from the speech output buffer
        //     message = this.config.sanitizer['profanity-replacement'];
        //     this.speechBuffer = message;
        //     //return;
        // }

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
            logger.debug(`Response output expired, clearing file`);
            this._clearResponseOutput();
        }, this.config.messages['response-expire-time'], thisId);
    }

    getResponse(id) {
        return this.responseHistory[id];
    }

    sendResponse(messages, history) {
        const prompt = this._generateResponse(messages, history);
        this.ooba.send(prompt);
        const dequeuedMessages = this.nextResponseID - this.lastResponseID;
        this.awaitingResponse = true;
        this.lastResponseID = this.nextResponseID;
        this._clearResponseOutput();
        return dequeuedMessages;
    }

    _generateResponse(messages, history) {
        const directiveTokens = this.persona.numTokens;
        const maxTokens = this.config.messages['max-tokens'] - directiveTokens - this.promptTokens - 2;
        logger.debug(`max tokens remaining for chat: ${maxTokens}`);

        let tokens = 0;
        let dequeuedMessages = 0;
        let message, tokensPerMessage;
        // Add as many new messages as possible
        for (let i = 0; i < messages.length; i++) {
            message = messages[i];
            tokensPerMessage = this._addMessageToResponse(message, tokens, maxTokens);
            if (tokensPerMessage === -1) {
                logger.warn(`max tokens reached, unable to add enqueued message`);
                break;
            } else {
                tokens += tokensPerMessage;
                dequeuedMessages++;    
            }
        }
        // Add as many historical messages as possible
        for (let i = 0; i < history.length; i++) {
            message = history[i];
            tokensPerMessage = this._addMessageToResponse(message, tokens, maxTokens, true);
            if (tokensPerMessage === -1) {
                logger.warn(`max tokens reached, unable to add historical message`);
                break;
            } else {
                tokens += tokensPerMessage;
            }
        }

        this.nextResponseID = this.lastResponseID + dequeuedMessages;
        const prompt = this.persona.directive + "\n"
            + this.chatPrompt + this.responseBuffer.join('') + `\n${this.responsePrefix}`;
        logger.debug(`Used ${tokens} tokens to respond to ${this.responseBuffer.length} messages`);
        this.responseBuffer = [];
        return prompt;
    }

    _addMessageToResponse(msg, tokens, maxTokens, front=false) {
        logger.debug(`Adding message to response: ${msg.text}`)
        const txt = `${msg.username}: ${msg.text}${this.chatDelimiter}\n`;
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

module.exports = ResponseHandler;