const { spawn } = require('child_process');

class VoiceHandler {
    constructor(options) {
        this.exe_location = options.exe_location;
        this.audio_device = options.audio_device;
        this.is_speaking = false;
    }

    speak(message) {
        if (this.is_speaking) {
            console.warn(`WinTTS is already speaking`);
            return;
        }
        this.is_speaking = true;
        // spawn child process to speak message
        console.info(`WinTTS speaking: ${message}`);
        const child = spawn(this.exe_location, [message, this.audio_device]);
        child.on('exit', (code, signal) => {
            console.info(`WinTTS exited`);
            this.is_speaking = false;
        });
    }
}

module.exports = VoiceHandler;