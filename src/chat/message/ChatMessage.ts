import logger from '../../util/Logger';
import MessageAttachment from './MessageAttachment';

interface ChatMessageOptions {
    [key: string]: any;
}

class ChatMessage {
    public author: string;
    public text: string;
    public timestamp: number;
    public options: ChatMessageOptions;
    public attachments: MessageAttachment[];
    public channel: string | null;
    public directReply: boolean;
    public isReply: boolean;
    public reply?: (message: string) => void;

    constructor(author: string, text: string, options: ChatMessageOptions = {}) {
        this.author = author;
        this.text = text;
        this.timestamp = Date.now();
        this.options = options;

        this.attachments = [];

        this.channel = null;
        this.directReply = false;
        this.isReply = false;
    }

    getText(): string {
        let text = this.text;
        if (this.attachments.length > 0) {
            text += '\n';
            this.attachments.forEach(attachment => {
                text += `[${attachment.type}:${attachment.caption}]\n`;
            });
        }
        return text;
    }
}

export default ChatMessage;