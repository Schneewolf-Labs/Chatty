const logger = require('../util/logger');
const tmi = require('tmi.js');
const ChatServiceInterface = require('../chat/ChatServiceInterface');
const ChatMessage = require('../chat/message/ChatMessage');

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
        logger.debug('Twitch does not support sending images');
    }

    sendTyping() {
        logger.debug('Twitch does not support sending typing indicators');
    }

    _handleMessage(channel, tags, message, self) {
        if (self) return;
        const chatMessage = new ChatMessage(tags.username, message);
        chatMessage.reply = (txt) => {
            // reply to original twitch message
            this.client.say(channel, `@${tags.username}, ${txt}`);
        }
        this.emit('message', chatMessage);
    }
}

module.exports = TwitchClient;