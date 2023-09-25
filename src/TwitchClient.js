const tmi = require('tmi.js');

// Twitch CLient class
class TwitchClient {
    constructor(messageManager, username, channel, token) {
        this.messageManager = messageManager;
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
            if (self) return;
            const msg = {
                username: tags.username,
                text: message,
                timestamp: Date.now(),

            };
            this.messageManager.receiveMessage(msg);
            // console.log(`${tags['display-name']}: ${message}`);
            // console.log('Sentiment score: ' + sentiment.analyze(message).score);
            // if (self) return;
            // if (filter.isProfane(message)) {
            //     twitch.say(channel, `@${tags.username}, please watch your language!`);
            // }
        });

        this.messageHistory = [];
        this.chatQueue = [];
        this.promptQueue = [];
    }

    connect() {
        this.client.connect();
    }

}

module.exports = TwitchClient;