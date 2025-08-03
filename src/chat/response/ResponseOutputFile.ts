import * as process from 'process';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../../util/Logger';
import ChatServiceInterface from '../ChatServiceInterface';
import { ChatMessage as ChatMessageInterface } from '../ChatServiceInterface';

interface OutputFileConfig {
    oobabooga: {
        output_location: string;
    };
    messages: {
        'response-expire-time': number;
    };
    [key: string]: any;
}

class ResponseOutputFile extends ChatServiceInterface {
    private config: OutputFileConfig;
    private outputPath: string;
    private responses: string[];

    constructor(config: OutputFileConfig) {
        super();
        this.config = config;
        this.outputPath = path.join(process.cwd(), config.oobabooga.output_location);

        this.responses = [];
    }

    sendMessage(message: ChatMessageInterface): void {
        const text = message.text;
        logger.debug(`ResponseOutputFile got message: ${text}`);
        this.receiveResponse(text);
    }

    sendImage(): void {
        logger.debug('ResponseOutputFile ignoring request to send image');
    }

    sendTyping(): void {
        logger.debug('ResponseOutputFile ignoring request to send typing indicator');
    }

    receiveResponse(response: string): void {
        this.responses.push(response);
        this.updateResponseFile();
        setTimeout(() => {
            const response = this.responses.shift();
            logger.debug(`ResponseOutputFile expiring response: ${response}`);
            this.updateResponseFile();
        }, this.config.messages['response-expire-time']);
    }

    updateResponseFile(): void {
        const response = this.responses.join(' ');
        fs.writeFileSync(this.outputPath, response);
    }

}

export default ResponseOutputFile;