import logger from '../util/Logger';
import { EventEmitter } from 'events';

interface OobaSettings {
    baseUrl: string;
    requestParams: any;
    [key: string]: any;
}

interface OobaResponse {
    choices: Array<{ text: string }>;
}

class OobaClient extends EventEmitter {
    private settings: OobaSettings;
    private baseUrl: string;
    private requestParams: any;
    private messageQueue: string[];
    private recievingMessage: boolean;

    constructor(settings: OobaSettings) {
        super();
        this.settings = settings;
        this.baseUrl = settings.baseUrl;
        this.requestParams = settings.requestParams;

        this.messageQueue = [];
        this.recievingMessage = false;

        logger.debug(`Attempting to connect to oobabooga at ${this.baseUrl}`);
        this._connect();
    }

    send(prompt: string): void {
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
                let buffer = '';
                const read = (): void => {
                    reader.read().then(({done, value}) => {
                        if (done) {
                            if (buffer) {
                                logger.warn('Partial data remaining in buffer after stream ended');
                            }
                            logger.debug('Message stream from Oobabooga ended...');
                            const message = this.flush();
                            this.emit('message', message);
                            this.recievingMessage = false;
                            return;
                        } else {
                            buffer += decoder.decode(value, {stream: true});
                            let newlineIndex;
                            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                                const line = buffer.slice(0, newlineIndex);
                                buffer = buffer.slice(newlineIndex + 1);
                                if (line.startsWith('data: ')) {
                                    const text = line.slice(6); // remove 'data: ' prefix
                                    try {
                                        const json: OobaResponse = JSON.parse(text);
                                        const token = json.choices[0].text;
                                        if (!this.recievingMessage) logger.debug('Message stream from Oobabooga started...');
                                        this.recievingMessage = true;
                                        this.messageQueue.push(token);
                                        this.emit('token', token);
                                    } catch (err: any) {
                                        logger.error(`Error parsing json from stream: ${err}`);
                                    }
                                }
                            }
                        }
                        read();
                    }).catch((err: any) => {
                        logger.error(`Error reading stream: ${err}`);
                    });
                };
                read();                
            } else {
                logger.error(`Error sending prompt: ${res.status} ${res.statusText}`);
            }
        }).catch((err: any) => {
            logger.error(`Error sending prompt: ${err}`);
        });
    }

    stop(): void {
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
        }).catch((err: any) => {
            logger.error(`Error stopping stream: ${err}`);
        });
    }

    flush(): string {
        // empty message queue into a single string
        const message = this.messageQueue.join('');
        this.messageQueue = [];
        return message;
    }

    _connect(): void {
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
        }).catch((err: any) => {
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

export default OobaClient;