const { Client, Intents } = require('discord.js');

class DiscordClient {
    constructor(token, channelId) {
        this.client = new Client({ intents: [Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILDS] });
        this.channelId = channelId;
        
        this.client.on('ready', () => {
            console.log(`Logged in as ${this.client.user.tag}!`);
        });

        this.client.on('messageCreate', (message) => {
            if (message.channel.id === this.channelId && !message.author.bot) {
                this._handleMessage(message);
            }
        });
    }

    connect() {
        this.client.login(this.token);
    }

    _handleMessage(message) {
        console.log(`Received message from ${message.author.tag}: ${message.content}`);
    }

}

module.exports = DiscordClient;
