const logger = require('../util/Logger');
const { spawn } = require('child_process');

class VoiceHandler {
    constructor(options) {
        this.options = options;
        this.exe_location = options.exe_location;
        this.voice_index = options.voice_index;
        this.audio_device = options.audio_device;
        this.alphanumeric_only = options.alphanumeric_only;
        this.maxDuration = options['max-speak-duration'];
        this.durationTimer = null;

        this.is_speaking = false;
        this.queue = [];
        this.voice_process = spawn(this.exe_location, [this.voice_index, this.audio_device]);
        this.voice_process.on('error', (err) => {
            logger.error(`Error WinTTS: ${err}`);
        });
        this.voice_process.stdout.on('data', (data) => {
            const message = data.toString().trim();
            if (message === 'TOKEN_PLAYBACK_FINISHED') {
                logger.debug(`WinTTS finished speaking`);
                if (this.durationTimer) clearTimeout(this.durationTimer);
                this._dequeue();
            }
        });
        this.voice_process.on('close', (code) => {
            logger.error(`WinTTS exited with code ${code}`);
        });
    }

    speak(token, force=false) {
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
        this.voice_process.stdin.write(token+'\n');
        // Set a timer to dequeue the next token if the current one takes too long
        this.durationTimer = setTimeout(() => {
            logger.warn(`WinTTS took too long to speak, dequeuing`);
            this._dequeue();
        }, this.maxDuration);
    }

    _dequeue() {
        if (this.durationTimer) clearTimeout(this.durationTimer);
        if (this.queue.length > 0) {
            const token = this.queue.shift();
            this.speak(token, true);
        } else {
            this.is_speaking = false;
        }
    }
}

module.exports = VoiceHandler;