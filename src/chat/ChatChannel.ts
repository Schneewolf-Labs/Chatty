import logger from '../util/Logger';
import { EventEmitter } from 'events';
import MessageManager from './message/MessageManager';
import ChatMessage from './message/ChatMessage';

interface Config {
    messages: any;
    [key: string]: any;
}

interface ResponseHandler {
    addChannel(channel: ChatChannel): void;
    sendResponse(messages: ChatMessage[], history: any[], channelID: string): number;
    emitResponse(message: string, channel: string): void;
    addEventToHistory(event: string, channelID: string): void;
    getResponse(id: number, channelID: string): string | null;
    updateLastResponseID(id: number, channelID: string): void;
    on(event: string, callback: Function): void;
    persona: {
        name: string;
    };
}

interface OobaClient {
    [key: string]: any;
}

interface DrawManager {
    [key: string]: any;
}

interface VoiceService {
    [key: string]: any;
}

class ChatChannel extends EventEmitter {
    public channelID: string;
    public config: Config;
    public ooba: OobaClient;
    public responseHandler: ResponseHandler;
    public messageManager: MessageManager;
    public lastResponseTime: number;

    constructor(channelID: string, config: Config, ooba: OobaClient, responseHandler: ResponseHandler) {
        super();
        this.channelID = channelID;
        this.config = config;
        this.ooba = ooba;
        this.responseHandler = responseHandler;
        this.messageManager = new MessageManager(config.messages, this);

        this.lastResponseTime = 0;

        this.responseHandler.addChannel(this);
        this.responseHandler.on('response', (response: any) => {
            logger.debug(`response channel: ${response.channel}, this channel: ${this.channelID}`);
            // check if this response is for this channel
            if (response.channel !== this.channelID) return;
            this.emit('response', response);
            this.lastResponseTime = Date.now();
        });
        this.responseHandler.on('token', (token: any) => {
            logger.debug(`token channel: ${token.channel}, this channel: ${this.channelID}`);
            if (token.channel !== this.channelID) return;
            this.emit('token', token);
        });

        logger.info(`Created chat channel ${channelID}`);
    }

    sendResponse(message: string, channel: string): void {
        this.responseHandler.emitResponse(message, channel);
    }

    enqueueResponse(messages: ChatMessage[], history: any[]): number {
        return this.responseHandler.sendResponse(messages, history, this.channelID);
    }

    addEventToHistory(event: string): void {
        logger.debug(`Channel ${this.channelID} adding event to history: ${event}`);
        this.responseHandler.addEventToHistory(event, this.channelID);
    }

    getResponse(id: number): string | null {
        return this.responseHandler.getResponse(id, this.channelID);
    }

    setDrawManager(drawManager: DrawManager): void {
        this.messageManager.setDrawManager(drawManager as any);
    }

    setVoiceService(voiceService: VoiceService): void {
        this.messageManager.setVoiceService(voiceService as any);
    }

    updateLastResponseID(id: number): void {
        this.responseHandler.updateLastResponseID(id, this.channelID);
    }
}

export default ChatChannel;