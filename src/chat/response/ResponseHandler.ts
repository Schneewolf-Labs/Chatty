import logger from '../../util/Logger';
import { EventEmitter } from 'events';
import ResponseStreamer from './ResponseStreamer';
import ResponsePrompter from './ResponsePrompter';
import ResponseHistory from './ResponseHistory';
import ChatMessage from '../message/ChatMessage';
import ResponseToken from './ResponseToken';
import RepetitionDetector from '../../util/RepetitionDetector';

interface HandlerConfig {
    messages: {
        'block-repetitive-responses': boolean;
        'throttle-history-on-repetitive-response': boolean;
        'repetition-threshold': number;
        'chat-history-length': number;
        'chat-delimiter': string;
        'chat-prefix': string;
        'illegal-response-tokens': string[];
        'chunk-delimiters': string[];
        'datetime-prompt': string;
        'persona-prompt': string;
        'draw-available-prompt': string;
        'prompt': string;
        'safety-prompt': string;
        'limitations-prompt': string;
        'chat-history-prefix': string;
        'prompt-response-prefix': string;
        'new-chat-prefix': string;
        'max-tokens': number;
        'include-datetime': boolean;
        [key: string]: any;
    };
    stable_diffusion: {
        enabled: boolean;
    };
    [key: string]: any;
}

interface OobaClient {
    send(prompt: string): void;
    on(event: string, listener: (data: any) => void): void;
    stop(): void;
}

interface Persona {
    name: string;
    directive?: string;
    insertName?: (message: string) => string;
    [key: string]: any;
}

interface Channel {
    channelID: string;
    [key: string]: any;
}

interface ResponseQueueItem {
    id: number;
    prompt: string;
    channel: string;
}

class ResponseHandler extends EventEmitter {
    public config: HandlerConfig;
    private ooba: OobaClient;
    private persona: Persona;
    private responseStreamer: ResponseStreamer;
    private responsePrompter: ResponsePrompter;
    private repetitionDetector: RepetitionDetector;
    private responseQueue: ResponseQueueItem[];
    private histories: { [key: string]: ResponseHistory };
    private awaitingResponse: boolean;
    private currentChannel: string | null;
    private throttleHistory: boolean;

    constructor(config: HandlerConfig, ooba: OobaClient, persona: Persona) {
        super();
        this.config = config;
        this.ooba = ooba;
        this.persona = persona;
        this.responseStreamer = new ResponseStreamer(config, this, this.ooba);
        this.responsePrompter = new ResponsePrompter(config, persona, this);
        this.repetitionDetector = new RepetitionDetector(config.messages['repetition-threshold'], config.messages['chat-history-length']/2);

        this.responseQueue = [];
        this.histories = {};
        this.awaitingResponse = false;
        this.currentChannel = null;
        this.throttleHistory = false;

        // Handle events from the response streamer
        this.responseStreamer.on('chunk', (response: string) => {
            // A response has completed
            this._handleMessage(response);
        });
        this.responseStreamer.on('token', (token: string) => {
            const resToken = new ResponseToken(token, this.currentChannel);
            this.emit('token', resToken);
        });
    }

    _handleMessage(message: string): void {
        logger.debug(`Received message from ResponseStreamer: ${message}`);
        this.awaitingResponse = false;
        // Check if message is empty
        if (message.length === 0) {
            logger.warn(`Response is empty`);
        }

        // Check if message is repetitive
        let shouldRespond = true;
        if (this.config.messages['block-repetitive-responses']) {
            const isRepetitive = this.repetitionDetector.isRepetitive(message, this.getHistory(this.currentChannel));
            if (isRepetitive) {
                logger.warn(`Response is repetitive, blocking`);
                this.responseStreamer.abort(false); // do not emit the last chunk
                shouldRespond = false;
                if (this.config.messages['throttle-history-on-repetitive-response']) {
                    this.throttleHistory = true;
                }
            }
        }

        // Emit final response message for other services to consume
        if (shouldRespond) this.emitResponse(message, this.currentChannel);

        // Dequeue next response
        if (this.responseQueue.length > 0) {
            logger.debug(`Response queue is not empty, dequeuing next response`);
            const nextResponse = this.responseQueue.shift();
            this.currentChannel = nextResponse.channel;
            this._sendResponse(nextResponse.prompt);
        }
    }

    addChannel(channel: Channel): void {
        const channelID = channel.channelID;
        this.histories[channelID] = new ResponseHistory(this.persona);
        logger.debug(`Added channel ${channelID} to response handler`);
    }

    updateLastResponseID(id: number, channel: string): void {
        const history = this.getHistory(channel);
        history.setLastResponseID(id);
    }

    getHistory(channel: string): ResponseHistory {
        return this.histories[channel];
    }

    getResponse(id: number, channel: string): string | undefined {
        const history = this.histories[channel];
        return history.getResponse(id);
    }

    addResponseToHistory(response: string, channel: string): void {
        logger.debug(`Adding response to history: ${response} for channel ${channel}`);
        const history = this.histories[channel];
        history.addResponse(response);
    }

    addEventToHistory(event: string, channel: string): void {
        const history = this.histories[channel];
        history.addEvent(event);
    }

    emitResponse(response: string, channel: string): void {
        // Package in ChatMessage format
        const message = new ChatMessage(this.persona.name, response);
        message.channel = channel;
        this.emit('response', message);
    }

    sendResponse(messages: ChatMessage[], history: string[], channel: string): number {
        // Get History
        const channelHist = this.histories[channel];
        // Check if chat history should be throttled
        if (this.throttleHistory) {
            logger.debug(`Throttling history for channel ${channel}`);
            history = [];
            this.throttleHistory = false;
        }
        // Generate a response prompt
        const { prompt, dequeuedMessages } = this.responsePrompter.generatePrompt(messages, history);

        //channelHist.lastResponseID = channelHist.lastResponseID + dequeuedMessages;

        if (this.awaitingResponse) {
            logger.debug('Currently awaiting response, enqueuing response: ' + prompt);
            const resQueueItem = {
                id: channelHist.lastResponseID,
                prompt: prompt,
                channel: channel
            }
            this.responseQueue.push(resQueueItem);
        } else {
            logger.debug('Sending response: ' + prompt);
            this.currentChannel = channel;
            this._sendResponse(prompt);
        }
        
        return dequeuedMessages;
    }

    _sendResponse(prompt: string): void {
        this.ooba.send(prompt);
        this.awaitingResponse = true;
    }

}

export default ResponseHandler;