const logger = require('../util/logger');
const Buffer = require('buffer').Buffer;
const { Client, Events, GatewayIntentBits, Partials, ChannelType } = require('discord.js');
const ChatServiceInterface = require('../chat/ChatServiceInterface');
const ChatMessage = require('../chat/message/ChatMessage');

class DiscordClient extends ChatServiceInterface {
    constructor(token, settings) {
        super();
        this.token = token;
        this.channels = settings['channels'];
        this.partials = [];
        this.intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
        if (settings['chat-enabled']) this.intents.push(GatewayIntentBits.MessageContent);
        if (settings['allow-dms']) {
            this.intents.push(GatewayIntentBits.DirectMessages);
            this.partials.push(Partials.Channel, Partials.Message);
        }
        this.client = new Client({ intents: this.intents, partials: this.partials });
        this.settings = settings;
        
        this.client.once(Events.ClientReady, c => {
            logger.info(`Discord Ready! Logged in as ${c.user.tag}`);
        });

        if (settings['chat-enabled']) {
            this.client.on(Events.MessageCreate, message => {
                logger.debug(`Received message from ${message.author.tag} in ${message.channel.id}`);
                const isDM = this.settings['allow-dms'] && message.channel.type === ChannelType.DM;
                const isChannel = this.channels.includes(message.channel.id);
                if (isChannel || isDM) {
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
        logger.debug(`Sending message to ${message.channel}: ${message.text}`);
        const text = message.text;
        const channel = this._getChannel(message.channel);
        // chunk messages by discord max length
        const max = 2000;
        const chunks = text.match(new RegExp(`.{1,${max}}`, 'g'));
        if (!chunks) return;
        logger.debug(`Sending ${chunks.length} chunks`);
        chunks.forEach(chunk => {
            this._sendMessage(chunk, channel);
        });
    }

    sendImage(image) {
        if (!this.settings['post-image-output']) return;
        // convert base64 string to buffer
        const buffer = Buffer.from(image.data, 'base64');
        // send buffer as attachment
        const channel = this._getChannel(image.channel);
        channel.send({
            files: [buffer]
        });
    }

    sendTyping(channelID) {
        if (!this.settings['send-is-typing']) return;
        if (!channelID) return;
        logger.debug(`Sending typing indicator to ${channelID}`);
        const channel = this.client.channels.cache.get(channelID);
        channel.sendTyping();
    }

    _sendMessage(message, channel) {
        channel.send(message);
    }

    _handleMessage(message) {
        logger.debug(`Handling message from ${message.author.tag}: ${message.content}`);
        const chatMessage = new ChatMessage(message.author.username, message.content);
        chatMessage.channel = message.channel.id;
        const isReply = message.reference;
        if (isReply) {
            const referenceMessage = message.channel.messages.cache.get(message.reference.messageId);
            if (referenceMessage && referenceMessage.author.id === this.client.user.id) {
                logger.debug(`Message is a reply to a message from the bot`);
                chatMessage.directReply = true;
            }
        }
        chatMessage.reply = (txt) => {
            // reply to original discord message
            message.reply(txt);
        }
        this.emit('message', chatMessage);
    }

    _getChannel(channelID) {
        let channel = this.client.channels.cache.get(channelID);
        if (!channel) {
            if (!this.settings['fallback-to-default-channel']) return;
            logger.warn(`Could not find channel ${channelID}, falling back to default channel`);
            const defaultIdx = this.settings['default-channel'];
            const defaultChannel = this.client.channels.cache.get(this.channels[defaultIdx]);
            if (!defaultChannel) {
                logger.error(`Could not find default channel ${defaultIdx}`);
                return;
            }
            channel = defaultChannel;
        }
        return channel;
    }

}

module.exports = DiscordClient;
