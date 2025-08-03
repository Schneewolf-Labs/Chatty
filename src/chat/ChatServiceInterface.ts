import logger from '../util/Logger';
import { EventEmitter } from 'events';

export interface ChatMessage {
    text: string;
    channel: string;
}

export interface ChatImage {
    data: string;
    channel: string;
}

// @emits message
abstract class ChatServiceInterface extends EventEmitter {
    constructor() {
        super();
    }

    // Send a message to the chat service
    sendMessage(message: ChatMessage): void {
        logger.error(`sendMessage not implemented but got message: ${message}`);
        throw new Error('sendMessage not implemented');
    }

    // Send an image to the chat service
    sendImage(image: ChatImage): void {
        logger.error(`sendImage not implemented but got image: ${image}`)
        throw new Error('sendImage not implemented');
    }

    // Send a typing indicator to the chat service
    sendTyping(channelID?: string): void {
        throw new Error('sendIsTyping not implemented');
    }
}

export default ChatServiceInterface;