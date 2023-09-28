const tmi = require('tmi.js');

const EventEmitter = require('events');

// Twitch CLient class
class TwitchClient extends EventEmitter {
    constructor(username, channel, token) {
        super();
        this.username = username;
        this.channel = channel;
        this.token = token;
        this.client = new tmi.Client({
            options: { debug: true },
            connection: {
                secure: true,
                reconnect: true
            },
            identity: {
                username: this.username,
                password: this.token
            },
            channels: [ this.channel ]
        });
        
        // Listen to Twitch chat:
        this.client.on('message', (channel, tags, message, self) => {
            this._handleMessage(channel, tags, message, self);
        });
    }

    connect() {
        this.client.connect();
    }

    sendMessage(message) {
        this.client.say(this.channel, message);
    }

    _handleMessage(channel, tags, message, self) {
        if (self) return;
            const msg = {
                username: tags.username,
                display_name: tags['display-name'],
                text: message,
                timestamp: Date.now(),
                tags: tags,
                channel: channel
            };
            this.emit('message', msg);
    }
}

module.exports = TwitchClient;