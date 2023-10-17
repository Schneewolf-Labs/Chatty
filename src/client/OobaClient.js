const logger = require('../util/logger');
const WebSocket = require('ws');
const EventEmitter = require('events');

class OobaClient extends EventEmitter{
    constructor(settings) {
        super();
        this.settings = settings;
        this.baseUrl = settings.baseUrl;
        this.blockingUrl = settings.blockingUrl;
        this.requestParams = settings.requestParams;

        this.messageQueue = [];
        this.recievingMessage = false;

        this.uri = this.baseUrl+"/api/v1/stream";
        logger.debug(`Attempting to connect to oobabooga at ${this.uri}`);
        this._connect();
    }

    send(prompt) {
        logger.debug(`Sending prompt to Oobabooga: ${prompt}`);
        this.ws.send(JSON.stringify({
            prompt: prompt,
            ...this.requestParams
        }));
    }

    stop() {
        // use the blocking api to stop the stream with /api/v1/stop-stream
        const url = this.blockingUrl+"/api/v1/stop-stream";
        logger.debug(`Stopping stream with blocking api at ${url}`);
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.requestParams)
        }).then(res => {
            if (res.status === 200) {
                logger.info("Stream stopped");
            } else {
                logger.error(`Error stopping stream: ${res.status} ${res.statusText}`);
            }
        }).catch(err => {
            logger.error(`Error stopping stream: ${err}`);
        });
    }

    flush() {
        // empty message queue into a single string
        const message = this.messageQueue.join('');
        this.messageQueue = [];
        return message;
    }

    _connect() {
        this.ws = new WebSocket(this.uri);
        this.ws.on('open', () => {
            logger.info("Connected to Oobabooga");
        });
        this.ws.on('message', (data) => {
            const json = JSON.parse(data);
            if (json.event === 'text_stream') {
                if (!this.recievingMessage) logger.debug('Message stream from Oobabooga started...');
                this.recievingMessage = true;
                this.messageQueue.push(json.text);
                this.emit('token', json.text);
            } else if (json.event === 'stream_end') {
                logger.debug('Message stream from Oobabooga ended...');
                const message = this.flush();
                this.emit('message', message);
                this.recievingMessage = false;
            }
        });
        this.ws.on('error', (err) => {
            logger.error("Error connecting to Oobabooga: " + err);
        });
        this.ws.on('close', () => {
            logger.error("Connection to Oobabooga closed");
            // Attempt to reconnect
            setTimeout(() => {
                logger.info("Attempting to reconnect to Oobabooga...");
                this._connect();
            }, 5000);
        });
    }
}

module.exports = OobaClient;