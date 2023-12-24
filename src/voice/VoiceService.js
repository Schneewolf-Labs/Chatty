const logger = require('../util/logger');
const ChatServiceInterface = require('../chat/ChatServiceInterface');
const Whisper = require('./Whisper');

class VoiceService extends ChatServiceInterface {
    constructor(config) {
        super();
        this.config = config;
        this.tts = config.voice.tts;
        const TTS = require(`./${this.tts}`);
        this.voiceHandler = new TTS(config.voice);
        if (config.whisper['enabled']) {
            this.whisperHandler = new Whisper(config.whisper);
            this.whisperHandler.on('message', (message) => {
                logger.debug(`VoiceService emitting Whisper message: ${message.text}`);
                this.emit('message', message);
            });
        }
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
        return this.voiceHandler.isSpeaking();
    }

    isBlocking() {
        return this.config.voice['block_responses'] && this.isSpeaking();
    }
}

module.exports = VoiceService;