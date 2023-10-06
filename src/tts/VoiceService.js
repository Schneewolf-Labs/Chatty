const logger = require('../util/logger');
const ChatServiceInterface = require('../chat/ChatServiceInterface');
const WinTTS = require('./WinTTS');

class VoiceService extends ChatServiceInterface {
    constructor(config) {
        super();
        this.config = config;
        this.voiceHandler = new WinTTS(config.voice);

        // TODO: support input from a microphone to be encoded as text and emitted as a message
    }

    sendMessage(message) {
        const text = message.text;
        this.voiceHandler.speak(text);
    }

    sendImage() {
        logger.debug('VoiceService ignoring request to send image');
    }

    sendTyping() {
        logger.debug('VoiceService ignoring request to send typing indicator');
    }

    isSpeaking() {
        return this.voiceHandler.is_speaking;
    }

    isBlocking() {
        return this.config.voice['block_responses'] && this.isSpeaking();
    }
}

module.exports = VoiceService;