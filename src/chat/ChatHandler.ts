import logger from '../util/Logger';
import ChatChannel from './ChatChannel';
import MessageSanitizer from './message/MessageSanitizer';
import ChatMessage from './message/ChatMessage';
import OobaClient from '../client/OobaClient';
import ResponseHandler from './response/ResponseHandler';
import { EventEmitter } from 'events';

interface Config {
    oobabooga?: any;
    stable_diffusion?: any;
    sanitizer?: any;
    messages?: any;
    [key: string]: any;
}

interface Persona {
    name?: string;
    [key: string]: any;
}

interface ChatService {
    sendImage?(image: any): void;
    sendMessage?(response: any): void;
    sendTyping?(channelID: string): void;
    on?(event: string, callback: (message: any) => void): void;
    [key: string]: any;
}

interface VoiceService {
    isBlocking?: boolean;
    [key: string]: any;
}

class ChatHandler {
    private config: Config;
    private ooba: OobaClient;
    private persona: Persona;
    private sanitizer: MessageSanitizer;
    private responseHandler: ResponseHandler;
    private chatChannels: { [key: string]: ChatChannel };
    private chatServices: ChatService[];
    private isTyping: boolean;
    private drawManager: any;
    private voiceService: VoiceService | null;

    constructor(config: Config, persona: Persona) {
        this.config = config;
        this.ooba = new OobaClient(config.oobabooga);
        this.persona = persona;
        this.sanitizer = new MessageSanitizer(config.sanitizer, persona as any, config.messages?.['chat-delimiter']);
        this.responseHandler = new ResponseHandler(config as any, this.ooba, persona as any);
        this.chatChannels = {};
        this.chatServices = [];
        this.isTyping = false;

        this.drawManager = null;
        // If stable diffusion is enabled, initialize a draw manager and attach to message manager
        if (config.stable_diffusion.enabled === true) {
            const StableDiffClient = require('../client/StableDiffClient');
            const stableDiffClient = new StableDiffClient(config.stable_diffusion);
            stableDiffClient.on('ok', () => {
                logger.info('Stable Diffusion client OK, initializing DrawManager');
                const DrawManager = require('../draw/DrawManager');
                const drawManager = new DrawManager(stableDiffClient);
                drawManager.on('image', (image) => {
                    this.chatServices.forEach((service) => {
                        service.sendImage(image);
                    });
                });
                this.drawManager = drawManager;
            });
            stableDiffClient.on('error', () => {
                logger.error('Stable Diffusion client error, aborting DrawManager initialization');
                config.stable_diffusion.enabled = false;
            });
        }
        this.voiceService = null;
    }

    registerChatService(service: ChatService): void {
        this.chatServices.push(service);
        service.on('message', (message) => {
            const isProfane = this.sanitizer.shouldReject(message.text);
            if (isProfane) {
                logger.info(`rejected message from ${message.author}`);
                return;
            }
            const channelID = message.channel;
            if (!this.chatChannels[channelID]) {
                this.createChatChannel(channelID);
            }
            const chatChannel = this.chatChannels[channelID];
            chatChannel.messageManager.receiveMessage(message);
        });
    }

    createChatChannel(channelID: string): void {
        if (this.chatChannels[channelID]) {
            logger.warn(`Chat channel ${channelID} already exists`);
            return;
        }

        const chatChannel = new ChatChannel(channelID, this.config as any, this.ooba, this.responseHandler as any);
        chatChannel.setDrawManager(this.drawManager);

        // Send responses to all registered chat services
        chatChannel.on('response', (response) => {
            logger.debug('ChatHandler got response: ' + response.text + ' from channel ' + response.channel);
            let text = response.text;
            this.isTyping = false;
            // Ensure the response is just the persona's
            text = this.sanitizer.trimResponse(text);
            // Remove links and other garbage
            text = this.sanitizer.sanitize(text);
            // Check if the message should be rejected
            if (this.sanitizer.shouldReject(text)) {
                logger.warn(`Response from Oobabooga was rejected`);
                // Replace the profane message and remove the response from the speech output buffer
                text = this.config.sanitizer['profanity-replacement'];
            }
            // Put the sanitized response into history
            this.responseHandler.addResponseToHistory(text, chatChannel.channelID);
            // Set response channel
            response.channel = chatChannel.channelID;
            response.text = text;

            // Send the response to all registered chat services
            this.chatServices.forEach((service) => {
                service.sendMessage(response);
            });
        });

        // Notify all registered chat services when the AI is "typing"
        chatChannel.on('token', (token) => {
            //logger.debug(`ChatHandler got token: ${token}`)
            if (!token) return;
            if (!this.isTyping) {
                this.isTyping = true;
                this.chatServices.forEach((service) => {
                    service.sendTyping(chatChannel.channelID);
                });
            }
        });

        this.chatChannels[channelID] = chatChannel;
    }

    setVoiceService(voiceService: VoiceService): void {
        this.voiceService = voiceService;
        // set voice service for all chat channels
        Object.values(this.chatChannels).forEach((chatChannel) => {
            chatChannel.setVoiceService(voiceService);
        });
    }
}

export default ChatHandler;