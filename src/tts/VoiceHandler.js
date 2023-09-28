const { spawn } = require('child_process');

class VoiceHandler {
    constructor(options) {
        this.options = options;
        this.exe_location = options.exe_location;
        this.voice_index = options.voice_index;
        this.audio_device = options.audio_device;
        this.alphanumeric_only = options.alphanumeric_only;

        this.is_speaking = false;
        this.queue = [];
        this.voice_process = spawn(this.exe_location, [this.voice_index, this.audio_device]);
        this.voice_process.on('error', (err) => {
            console.error(`Error WinTTS: ${err}`);
        });
        this.voice_process.stdout.on('data', (data) => {
            const message = data.toString().trim();
            if (message === 'TOKEN_PLAYBACK_FINISHED') {
                console.info(`WinTTS finished speaking`);
                this._dequeue();
            }
        });
        this.voice_process.on('close', (code) => {
            console.error(`WinTTS exited with code ${code}`);
        });
    }

    speak(token, force=false) {
        if (!force && this.is_speaking) {
            console.warn(`WinTTS is already speaking`);
            this.queue.push(token);
            return;
        }
        if (!token) {
            console.warn(`WinTTS received empty token`);
            this._dequeue();
            return;
        }
        token = token.trim();
        console.info(`WinTTS speaking: ${token}`);
        // strip non-alphanumeric (except puncutation) characters if enabled
        if (this.alphanumeric_only) {
            token = token.replace(/[^a-zA-Z0-9\s.,!?']/g, '');
        }
        if (!token) {
            console.warn(`WinTTS stripped token, skipping`);
            this._dequeue();
            return;
        }
        this.is_speaking = true;
        this.voice_process.stdin.write(token+'\n');
    }

    _dequeue() {
        if (this.queue.length > 0) {
            const token = this.queue.shift();
            this.speak(token, true);
        } else {
            this.is_speaking = false;
        }
    }
}

module.exports = VoiceHandler;