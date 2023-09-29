const logger = require('../util/Logger');
const tmi = require('tmi.js');
const ChatServiceInterface = require('../chat/ChatServiceInterface');

// Twitch CLient class
class TwitchClient extends ChatServiceInterface {
    constructor(username, channel, token, settings) {
        super();
        this.username = username;
        this.channel = channel;
        this.token = token;
        this.client = new tmi.Client({
            options: { debug: false },
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
        this.settings = settings;

        // On connect:
        this.client.on('connected', (address, port) => {
            logger.info(`Connected to Twitch channel ${this.channel} at ${address}:${port}`);
        });
        
        // Listen to Twitch chat:
        if (settings['chat-enabled']) {
            this.client.on('message', (channel, tags, message, self) => {
                this._handleMessage(channel, tags, message, self);
            });
        }

        this.connect();
    }

    connect() {
        this.client.connect();
    }

    sendMessage(message) {
        if (!this.settings['reply-in-chat']) return;
        this.client.say(this.channel, message);
    }

    sendImage() {
        logger.warn('Twitch does not support sending images');
    }

    sendIsTyping() {
        logger.warn('Twitch does not support sending typing indicators');
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