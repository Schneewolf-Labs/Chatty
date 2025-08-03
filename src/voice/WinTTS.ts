import logger from '../util/Logger';
import { spawn, ChildProcess } from 'child_process';
import TTSInterface from './TTSInterface';

interface WinTTSOptions {
    wintts: {
        exe_location: string;
        voice_index: string;
        audio_device: string;
    };
    alphanumeric_only: boolean;
    'max-speak-duration': number;
    [key: string]: any;
}

class WinTTS extends TTSInterface {
    private options: WinTTSOptions;
    private exe_location: string;
    private voice_index: string;
    private audio_device: string;
    private alphanumeric_only: boolean;
    private maxDuration: number;
    private durationTimer: NodeJS.Timeout | null;
    private is_speaking: boolean;
    private queue: string[];
    private voice_process: ChildProcess | null;

    constructor(options: WinTTSOptions) {
        super();
        this.options = options;
        this.exe_location = options.wintts.exe_location;
        this.voice_index = options.wintts.voice_index;
        this.audio_device = options.wintts.audio_device;
        this.alphanumeric_only = options.alphanumeric_only;
        this.maxDuration = options['max-speak-duration'];
        this.durationTimer = null;

        this.is_speaking = false;
        this.queue = [];

        this.voice_process = null;
        this._startProcess();
    }

    speak(token: string, force: boolean = false): void {
        if (!force && this.is_speaking) {
            logger.debug(`WinTTS is already speaking, enqueueing token: ${token}`);
            this.queue.push(token);
            return;
        }
        if (!token) {
            logger.warn(`WinTTS received empty token`);
            this._dequeue();
            return;
        }
        token = token.trim();
        logger.info(`WinTTS speaking: ${token}`);
        // strip non-alphanumeric (except puncutation) characters if enabled
        if (this.alphanumeric_only) {
            token = token.replace(/[^a-zA-Z0-9\s.,!?']/g, '');
        }
        if (!token) {
            logger.warn(`WinTTS stripped token, skipping`);
            this._dequeue();
            return;
        }
        this.is_speaking = true;
        this.voice_process!.stdin!.write(token+'\n');
        // Set a timer to dequeue the next token if the current one takes too long
        this.durationTimer = setTimeout(() => {
            logger.warn(`WinTTS took too long to speak, dequeuing`);
            this.is_speaking = false;
            this._dequeue();
        }, this.maxDuration);
    }

    isSpeaking(): boolean {
        return this.is_speaking;
    }

    _dequeue(): void {
        if (this.durationTimer) clearTimeout(this.durationTimer);
        if (this.queue.length > 0) {
            const token = this.queue.shift();
            this.speak(token, true);
        } else {
            this.is_speaking = false;
        }
    }

    _startProcess(): void {
        if (this.voice_process) {
            logger.debug(`WinTTS killing old process`);
            this.voice_process.kill();
        }
        logger.debug(`WinTTS starting new process`);
        this.is_speaking = false;
        this.voice_process = spawn(this.exe_location, [this.voice_index, this.audio_device]);
        this.voice_process.on('error', (err: Error) => {
            logger.error(`Error WinTTS: ${err}`);
        });
        this.voice_process.stdout?.on('data', (data: Buffer) => {
            const message = data.toString().trim();
            if (message === 'TOKEN_PLAYBACK_FINISHED') {
                logger.debug(`WinTTS finished speaking`);
                if (this.durationTimer) clearTimeout(this.durationTimer);
                this._dequeue();
            }
        });
        this.voice_process.on('close', (code: number | null) => {
            logger.warn(`WinTTS exited with code ${code}`);
            this._startProcess();
        });
    }
}

export default WinTTS;