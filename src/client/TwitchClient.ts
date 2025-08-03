import logger from '../util/Logger';
import * as tmi from 'tmi.js';
import ChatServiceInterface from '../chat/ChatServiceInterface';
import ChatMessage from '../chat/message/ChatMessage';
import { ChatMessage as ChatMessageInterface } from '../chat/ChatServiceInterface';

interface TwitchSettings {
    'chat-enabled': boolean;
    'reply-in-chat': boolean;
    [key: string]: any;
}

// Twitch Client class
class TwitchClient extends ChatServiceInterface {
    private username: string;
    private channel: string;
    private token: string;
    private client: tmi.Client;
    private settings: TwitchSettings;

    constructor(username: string, channel: string, token: string, settings: TwitchSettings) {
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
        this.client.on('connected', (address: string, port: number) => {
            logger.info(`Connected to Twitch channel ${this.channel} at ${address}:${port}`);
        });
        
        // Listen to Twitch chat:
        if (settings['chat-enabled']) {
            this.client.on('message', (channel: string, tags: tmi.ChatUserstate, message: string, self: boolean) => {
                this._handleMessage(channel, tags, message, self);
            });
        }

        this.connect();
    }

    connect(): void {
        this.client.connect();
    }

    sendMessage(message: ChatMessageInterface): void {
        if (!this.settings['reply-in-chat']) return;
        const text = message.text;
        this.client.say(this.channel, text);
    }

    sendImage(): void {
        logger.debug('Twitch does not support sending images');
    }

    sendTyping(): void {
        logger.debug('Twitch does not support sending typing indicators');
    }

    _handleMessage(channel: string, tags: tmi.ChatUserstate, message: string, self: boolean): void {
        if (self) return;
        const chatMessage = new ChatMessage(tags.username, message);
        chatMessage.reply = (txt: string) => {
            // reply to original twitch message
            this.client.say(channel, `@${tags.username}, ${txt}`);
        }
        this.emit('message', chatMessage);
    }
}

export default TwitchClient;