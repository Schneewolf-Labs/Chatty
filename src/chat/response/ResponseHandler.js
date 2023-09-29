const logger = require('../../util/Logger');
const EventEmitter = require('events');
const OobaClient = require('../../client/OobaClient');
const ResponseStreamer = require('./ResponseStreamer');
const ResponseOutputFile = require('./ResponseOutputFile');

class ResponseHandler extends EventEmitter {
    constructor(config, persona) {
        super();
        this.config = config;
        this.ooba = new OobaClient(config.oobabooga);
        this.persona = persona;
        this.responseStreamer = new ResponseStreamer(config, this);
        this.responseOutputFile = new ResponseOutputFile(config, this);

        this.responseQueue = [];
        this.responseHistory = {};
        this.lastResponseID = 0;
        this.nextResponseID = 0;
        this.processingResponseID = 0;
        this.awaitingResponse = false;
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
            logger.debug(`Received message from Oobabooga: ${message}`);
            this.responseStreamer.emitChunk();
            //this._handleMessage(message);
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
            this.emit('token', token);
            this.responseStreamer.receiveToken(token);
            if (reachedSpeechDelimiter) {
                this.abortStream = false;
            }
        });

        // Handle events from the response streamer
        this.responseStreamer.on('chunk', (response) => {
            // A response has completed
            this._handleMessage(response);
        });

        // If using Windows and voice is enabled, initialize voice synthesis
        this.voiceHandler = null;
        if (process.platform === 'win32' && config.voice.enabled === true) {
            const VoiceHandler = require('../../tts/VoiceHandler');
            const voiceHandler = new VoiceHandler(config.voice);
            this.voiceHandler = voiceHandler;
        }
    }

    _handleMessage(message) {
        logger.debug(`Received message from ResponseStreamer: ${message}`);
        // Check if message is empty
        if (message.length === 0) {
            logger.warn(`Response is empty`);
            //return;
        }

        // FIXME: make response history entries arrays of messages
        // Add response to response history
        this.responseHistory[this.processingResponseID] = message;

        // FIXME: move voice handler and response output file to chat handler
        // Speak response if voice is enabled
        if (this.voiceHandler) {
            this.voiceHandler.speak(message);
        }
        // Write response to output file
        this.responseOutputFile.receiveResponse(message);
        // Emit final response message for other services to consume
        this.emit('response', message);

        // Dequeue next response
        if (this.responseQueue.length > 0) {
            logger.debug(`Response queue is not empty, dequeuing next response`);
            const nextResponse = this.responseQueue.shift();
            this.processingResponseID = nextResponse[0];
            this._sendResponse(nextResponse[1]);
        }
        // XXX: this should be an interval that can retry when it is blocked
        // setTimeout((lastId) => {
        //     // Check if another response has been received since this one
        //     if (lastId != this.lastResponseID) return;
        //     // Check if another response is already being written
        //     if (this.awaitingResponse) return;
        //     // Check if voice handler is enabled and is speaking
        //     if (this.voiceHandler && this.voiceHandler.is_speaking) return;
        //     // Clear output file
        //     logger.debug(`Response output expired, clearing file`);
        //     this._clearResponseOutput();
        // }, this.config.messages['response-expire-time'], thisId);
    }

    getResponse(id) {
        return this.responseHistory[id];
    }

    voiceHandlerIsSpeaking() {
        if (!this.voiceHandler) return false;
        return this.voiceHandler.is_speaking;
    }

    sendResponse(messages, history) {
        // Generate a response prompt
        const prompt = this._generateResponsePrompt(messages, history);
        const dequeuedMessages = this.nextResponseID - this.lastResponseID;

        this.lastResponseID = this.nextResponseID;
        if (this.awaitingResponse) {
            logger.debug('Currently awaiting response, enqueuing response: ' + prompt);
            this.responseQueue.push([this.lastResponseID, prompt]);
        } else {
            logger.debug('Sending response: ' + prompt);
            this.processingResponseID = this.lastResponseID;
            this._sendResponse(prompt);
        }
        
        return dequeuedMessages;
    }

    _sendResponse(prompt) {
        this.ooba.send(prompt);
        this.awaitingResponse = true;
    }

    _generateResponsePrompt(messages, history) {
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
}

module.exports = ResponseHandler;