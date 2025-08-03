import logger from '../util/Logger';
import ChatServiceInterface from '../chat/ChatServiceInterface';
import { ChatMessage as ChatMessageInterface } from '../chat/ChatServiceInterface';
import Whisper from './Whisper';
import TTSInterface from './TTSInterface';

interface VoiceConfig {
    voice: {
        tts: string;
        block_responses?: boolean;
        [key: string]: any;
    };
    whisper: {
        enabled?: boolean;
        [key: string]: any;
    };
    [key: string]: any;
}

class VoiceService extends ChatServiceInterface {
    private config: VoiceConfig;
    private tts: string;
    private voiceHandler: TTSInterface;
    private whisperHandler?: Whisper;

    constructor(config: VoiceConfig) {
        super();
        this.config = config;
        this.tts = config.voice.tts;
        const TTS = require(`./${this.tts}`);
        this.voiceHandler = new TTS(config.voice);
        if (config.whisper && config.whisper['enabled']) {
            this.whisperHandler = new Whisper(config.whisper as any);
            this.whisperHandler.on('message', (message: any) => {
                logger.debug(`VoiceService emitting Whisper message: ${message.text}`);
                this.emit('message', message);
            });
        }
    }

    sendMessage(message: ChatMessageInterface): void {
        const text = message.text;
        this.voiceHandler.speak(text);
    }

    sendImage(): void {
        logger.debug('VoiceService ignoring request to send image');
    }

    sendTyping(): void {
        logger.debug('VoiceService ignoring request to send typing indicator');
    }

    isSpeaking(): boolean {
        return this.voiceHandler.isSpeaking();
    }

    isBlocking(): boolean {
        return this.config.voice['block_responses'] && this.isSpeaking();
    }
}

export default VoiceService;