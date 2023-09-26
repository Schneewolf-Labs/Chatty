const WebSocket = require('ws');
const EventEmitter = require('events');

class OobaClient extends EventEmitter{
    constructor(settings) {
        super();
        this.settings = settings;
        this.baseUrl = settings.baseUrl;
        this.requestParams = settings.requestParams;

        this.messageQueue = [];
        this.recievingMessage = false;

        const uri = this.baseUrl+"/api/v1/stream";
        console.log(`Attempting to connect to oobabooga at ${uri}`);
        this.ws = new WebSocket(uri);
        this.ws.on('open', () => {
            console.log("Connected to Oobabooga");
        });
        this.ws.on('message', (data) => {
            const json = JSON.parse(data);
            if (json.event === 'text_stream') {
                if (!this.recievingMessage) console.log('Message stream from Oobabooga started...');
                this.recievingMessage = true;
                this.messageQueue.push(json.text);
            } else if (json.event === 'stream_end') {
                const message = this.flush();
                this.emit('message', message);
                this.recievingMessage = false;
            }
        });
    }

    send(prompt) {
        console.log(`Sending prompt to Oobabooga: ${prompt}`);
        this.ws.send(JSON.stringify({
            prompt: prompt
        }));
    }

    flush() {
        // empty message queue into a single string
        const message = this.messageQueue.join('');
        this.messageQueue = [];
        return message;
    }
}

module.exports = OobaClient;