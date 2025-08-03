//import logger from './util/Logger';
import Persona from './util/Persona';
import Avatar from './util/Avatar';
import ChatHandler from './chat/ChatHandler';
import ChattyAPI from './api/ChattyAPI';

interface Config {
    persona_file: string;
    avatar: {
        enabled: boolean;
        location: string;
    };
    api: {
        enabled: boolean;
    };
    oobabooga?: any;
    stable_diffusion?: any;
    sanitizer?: any;
    messages?: any;
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
    sendImage?(image: any): void;
    sendMessage?(response: any): void;
    sendTyping?(channelID: string): void;
    on?(event: string, callback: (message: any) => void): void;
    [key: string]: any;
}

class Chatty {
    public config: Config;
    public persona: Persona;
    private chatHandler: ChatHandler;
    private avatar: Avatar | null;
    private api: ChattyAPI | null;

    constructor(config: Config) {
        this.config = config;
        this.persona = new Persona(config.persona_file);
        this.chatHandler = new ChatHandler(config, this.persona);

        this.avatar = null;
        if (config.avatar.enabled) {
            this.avatar = new Avatar(config.avatar.location);
        }

        this.api = null;
        if (config.api.enabled) {
            this.api = new ChattyAPI(this);
            this.api.start();
        }
    }

    registerChatService(service: ChatService): void {
        this.chatHandler.registerChatService(service);
    }

    attachVoiceService(service: VoiceService): void {
        this.chatHandler.registerChatService(service);
        this.chatHandler.setVoiceService(service);
    }
}

export default Chatty;