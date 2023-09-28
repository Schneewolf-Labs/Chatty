const { Client, Events, GatewayIntentBits } = require('discord.js');
const EventEmitter = require('events');

class DiscordClient extends EventEmitter {
    constructor(token, channelId) {
        super();
        this.token = token;
        this.channelId = channelId;
        this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
        
        this.client.once(Events.ClientReady, c => {
            console.log(`Discord Ready! Logged in as ${c.user.tag}`);
        });

        this.client.on(Events.MessageCreate, message => {
            if (message.channel.id === this.channelId) {
                if (message.author.bot) return; // TODO: configurable
                this._handleMessage(message);
            }
        });
    }

    connect() {
        this.client.login(this.token);
    }

    sendMessage(message) {
        this.client.channels.fetch(this.channelId)
            .then(channel => channel.send(message));
    }

    _handleMessage(message) {
        console.log(`Received message from ${message.author.tag}: ${message.content}`);
        const msg = {
            username: message.author.username,
            display_name: message.author.username,
            text: message.content,
            timestamp: Date.now(),
            tags: message.author,
            channel: message.channel
        };
        this.emit('message', msg);
    }

}

module.exports = DiscordClient;
