const { spawn } = require('child_process');

class VoiceHandler {
    constructor(options) {
        this.exe_location = options.exe_location;
        this.output_device = options.output_device;
    }

    speak(message) {
        console.log(`Speaking message: ${message}`);
        // spawn child process to speak message
        const child = spawn(this.exe_location, [message, this.output_device]);
        child.on('exit', (code, signal) => {
            console.info(`WinTTS exited`);
        });
    }
}

module.exports = VoiceHandler;