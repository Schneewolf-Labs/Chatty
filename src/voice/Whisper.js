const logger = require('../util/logger');
const { spawn } = require('child_process');
const EventEmitter = require('events');
const ChatMessage = require('../chat/message/ChatMessage');

class Whisper extends EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.exe_location = options.exe_location;
        this.model_location = options.model_location;
        this.audio_device = options.audio_device;
        this.file_output = options.file_output;

        //this.endToken = '<|endoftext|>';
        this.ready = false;
        this.buffer = [];

        this.whisper_process = null;
        this._startProcess();
    }

    isReady() {
        return this.ready;
    }

    _startProcess() {
        if (this.whisper_process) {
            logger.debug('Whisper process already running, killing');
            this.whisper_process.kill();
        }
        logger.info('Starting Whisper process');
        this.whisper_process = spawn(this.exe_location, [
            '-m', this.model_location,
            '-c', this.audio_device,
            '-f', this.file_output,
            //'-ps'
        ]);
        this.whisper_process.stdout.on('data', (data) => {
            this._processBuffer();
            //logger.debug(`Whisper stdout: ${data}`);
            const text = data.toString();
            // await [Start speaking] signal from Whisper
            if (!this.ready && text.includes('[Start speaking]')) {
                logger.info('Whisper ready');
                this.ready = true;
                this.emit('ready');
            } else if (this.ready) {
                // separate by lines
                const lines = text.split('\n');
                // add lines to the buffer
                this.buffer.push(...lines);
                logger.debug(`Pushed ${lines.length} lines to Whisper buffer`);
                //this._emitMessage(text);
            }
        });
        this.whisper_process.stderr.on('data', (data) => {
            logger.debug(`Whisper stderr: ${data}`);
        });
        this.whisper_process.on('close', (code) => {
            logger.warn(`Whisper process exited with code ${code}`);
            this.emit('exit');
            this.ready = false;
        });
    }

    _processBuffer() {
        const bufferLen = this.buffer.length;
        if (bufferLen === 0) {
            logger.debug('Whisper buffer is empty');
            return;
        }
        let lastLine = this.buffer[bufferLen - 1];
        lastLine = lastLine.trim();
        // eslint-disable-next-line no-control-regex
        lastLine = lastLine.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');        
        logger.debug(`Processing Whisper buffer of ${bufferLen} lines`);
        logger.debug(lastLine);
        this._emitMessage(lastLine);
        this.buffer = [];
    }

    _emitMessage(text) {
        //logger.debug(`Whisper processing text: ${text}`);
        // trim whitespace from text
        text = text.trim();
        // check text for any enclosed [] or () and remove them
        text = text.replace(/(\[.*?\]|\(.*?\))/g, '');
        // exit if text is empty
        if (!text) {
            logger.debug('Whisper text is empty, ignoring');
            return;
        } else {
            logger.debug('Whisper is emitting message:');
            logger.debug(text);
        }

        // TODO: discern who is talking and make them the author
        const msg = new ChatMessage('Whisper', text);
        this.emit('message', msg);
    }
}

module.exports = Whisper;