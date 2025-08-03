import ChatServiceInterface from '../chat/ChatServiceInterface';
import { ChatMessage, ChatImage } from '../chat/ChatServiceInterface';

interface APIInstance {
    broadcastMessage(message: ChatMessage): void;
    broadcastImage(image: ChatImage): void;
    broadcastTyping(): void;
}

class APIChatService extends ChatServiceInterface {
    private api: APIInstance;

    constructor(api: APIInstance) {
        super();
        this.api = api;
    }

    sendMessage(message: ChatMessage): void {
        // send message to api user
        this.api.broadcastMessage(message);
    }

    sendImage(image: ChatImage): void {
        // send image to api user
        this.api.broadcastImage(image);
    }

    sendTyping(): void {
        // send typing indicator to api user
        this.api.broadcastTyping();
    }
}

export default APIChatService;