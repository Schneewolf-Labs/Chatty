const logger = require('../util/logger');
const EventEmitter = require('events');

class OobaClient extends EventEmitter{
    constructor(settings) {
        super();
        this.settings = settings;
        this.baseUrl = settings.baseUrl;
        this.requestParams = settings.requestParams;

        this.messageQueue = [];
        this.recievingMessage = false;

        logger.debug(`Attempting to connect to oobabooga at ${this.baseUrl}`);
        this._connect();
    }

    send(prompt) {
        logger.debug(`Sending prompt to Oobabooga: ${prompt}`);
        const data = {
            prompt: prompt,
            ...this.requestParams,
            stream: true
        };
        fetch(this.baseUrl+"/v1/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).then(res => {
            if (res.status === 200) {
                logger.debug("Prompt sent, receiving streamed response...");
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                const read = () => {
                    reader.read().then(({done, value}) => {
                        if (done) {
                            logger.debug('Message stream from Oobabooga ended...');
                            const message = this.flush();
                            this.emit('message', message);
                            this.recievingMessage = false;
                            return;
                        } else {
                            try {
                                let text = decoder.decode(value, {stream: true});
                                text = text.replace('data: ', '');
                                const json = JSON.parse(text);
                                const token = json.choices[0].text;
                                if (!this.recievingMessage) logger.debug('Message stream from Oobabooga started...');
                                this.recievingMessage = true;
                                this.messageQueue.push(token);
                                this.emit('token', token);
                            } catch (e) {
                                logger.error(`Error parsing json: ${e}`);
                            }
                        }
                        read();
                    }).catch(err => {
                        logger.error(`Error reading stream: ${err}`);
                    });
                };
                read();                
            } else {
                logger.error(`Error sending prompt: ${res.status} ${res.statusText}`);
            }
        }).catch(err => {
            logger.error(`Error sending prompt: ${err}`);
        });
    }

    stop() {
        // use the blocking api to stop the stream with /api/v1/stop-stream
        const url = this.baseUrl+"/v1/internal/stop-generation";
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
        let connectionFailure = false;
        fetch(this.baseUrl+"/v1/models", {
            method: 'GET'
        }).then(res => {
            if (res.status === 200) {
                logger.info("Connected to Oobabooga: got models successfully");
            } else {
                logger.error(`Error getting Oobabooga models: ${res.status} ${res.statusText}`);
                connectionFailure = true;
            }
        }).catch(err => {
            logger.error(`Error getting Oobabooga models: ${err}`);
            connectionFailure = true;
        });

        if (connectionFailure) {
            // Attempt to reconnect
            setTimeout(() => {
                logger.info("Attempting to reconnect to Oobabooga...");
                this._connect();
            }, 5000);
        }
    }
}

module.exports = OobaClient;