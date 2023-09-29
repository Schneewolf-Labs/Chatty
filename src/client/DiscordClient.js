const logger = require('../util/Logger');
const { Client, Events, GatewayIntentBits } = require('discord.js');
const ChatServiceInterface = require('../chat/ChatServiceInterface');

class DiscordClient extends ChatServiceInterface {
    constructor(token, channelId, settings) {
        super();
        this.token = token;
        this.channelId = channelId;
        this.intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
        if (settings['chat-enabled']) this.intents.push(GatewayIntentBits.MessageContent);
        this.client = new Client({ intents: this.intents });
        this.settings = settings;
        
        this.client.once(Events.ClientReady, c => {
            logger.info(`Discord Ready! Logged in as ${c.user.tag}`);
        });

        if (settings['chat-enabled']) {
            this.client.on(Events.MessageCreate, message => {
                if (message.channel.id === this.channelId) {
                    if (message.author.bot) return; // TODO: configurable
                    this._handleMessage(message);
                }
            });
        }

        this.connect();
    }

    connect() {
        this.client.login(this.token);
    }

    sendMessage(message) {
        if (!this.settings['reply-in-chat']) return;
        // chunk messages by discord max length
        const max = 2000;
        const chunks = message.match(new RegExp(`.{1,${max}}`, 'g'));
        if (!chunks) return;
        logger.debug(`Sending ${chunks.length} chunks`);
        chunks.forEach(chunk => {
            this._sendMessage(chunk);
        });
    }

    sendImage(image) {
        if (!this.settings['post-image-output']) return;
        // convert base64 string to buffer
        const buffer = Buffer.from(image, 'base64');
        // send buffer as attachment
        const channel = this.client.channels.cache.get(this.channelId);
        channel.send({
            files: [buffer]
        });
    }

    sendIsTyping() {
        if (!this.settings['send-is-typing']) return;
        const channel = this.client.channels.cache.get(this.channelId);
        channel.sendTyping();
    }

    _sendMessage(message) {
        const channel = this.client.channels.cache.get(this.channelId);
        channel.send(message);
    }

    _handleMessage(message) {
        logger.debug(`Received message from ${message.author.tag}: ${message.content}`);
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
