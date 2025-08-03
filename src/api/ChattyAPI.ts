import logger from '../util/Logger';
import express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import APIChatService from './APIChatService';
import { ChatMessage, ChatImage } from '../chat/ChatServiceInterface';

interface ChattyInstance {
    config: any;
    persona: any;
    registerChatService(service: APIChatService): void;
}

interface APIMessage {
    event: string;
    data?: any;
}

class ChattyAPI {
    private chatty: ChattyInstance;
    private config: any;
    private chatService: APIChatService;
    private port: number;
    private app: express.Application;
    private httpServer: http.Server;
    private wss: WebSocket.Server;
    private avatar?: any;

    constructor(chatty: ChattyInstance) {
        this.chatty = chatty;
        this.config = chatty.config;
        this.chatService = new APIChatService(this);
        chatty.registerChatService(this.chatService);

        this.port = this.config.api.port;
        this.app = express();
        this.httpServer = http.createServer(this.app);
        this.wss = new WebSocket.Server({ 
            server: this.httpServer,
            path: '/api'
        });
        this.wss.on('connection', (ws) => {
            logger.info('Client connected to API');
            ws.on('message', (message) => {
                const messageStr = message.toString();
                logger.debug(`API got message: ${messageStr}`);
                this._handleAPIMessage(ws as any, messageStr);
            });
        });
    }

    start(): void {
        this.httpServer.listen(this.port, () => {
            logger.info(`Chatty API listening on port ${this.port}`);
        });
    }

    stop(): void {
        this.httpServer.close();
    }

    receiveMessage(message: ChatMessage): void {
        // receive message from api user
        this.chatService.emit('message', message);
    }

    sendMessage(client: WebSocket, message: ChatMessage): void {
        // send message to api user
        if (client.readyState === WebSocket.OPEN) {
            const msg = JSON.stringify({
                event: 'receive_message',
                data: message
            });
            client.send(msg);
        } else {
            logger.warn(`WebSocket client not open for sendMesage`)
        }
    }

    broadcastMessage(message: ChatMessage): void {
        // broadcast a message to all connected clients
        this.wss.clients.forEach((client: any) => {
            this.sendMessage(client, message);
        });
    }

    sendImage(client: WebSocket, image: ChatImage): void {
        // send image to api user
        if (client.readyState === WebSocket.OPEN) {
            const msg = JSON.stringify({
                event: 'receive_image',
                data: image
            });
            client.send(msg);
        } else {
            logger.warn(`WebSocket client not open for sendImage`)
        }
    }

    broadcastImage(image: ChatImage): void {
        // broadcast an image to all connected clients
        this.wss.clients.forEach((client: any) => {
            this.sendImage(client, image);
        });
    }

    sendTyping(client: WebSocket): void {
        // send typing indicator to api user
        if (client.readyState === WebSocket.OPEN) {
            const msg = JSON.stringify({
                event: 'receive_typing'
            });
            client.send(msg);
        } else {
            logger.warn(`WebSocket client not open for sendTyping`)
        }
    }

    broadcastTyping(): void {
        // broadcast a typing indicator to all connected clients
        this.wss.clients.forEach((client: any) => {
            this.sendTyping(client);
        });
    }

_handleAPIMessage(ws: WebSocket, message: string): void {
        // Handle incoming messages from the API here
        const msg: APIMessage = JSON.parse(message);
        switch (msg.event) {
            case 'send_message':
                var chatmsg = msg.data;
                chatmsg.reply = (response: ChatMessage) => {
                    this.sendMessage(ws, response);
                };
                this.receiveMessage(chatmsg);
                break;
            case 'request_persona':
                ws.send(JSON.stringify({
                    event: 'receive_persona',
                    data: this.chatty.persona
                }));
                break;
            case 'request_avatar':
                if (!this.config.avatar.enabled) return;
                ws.send(JSON.stringify({
                    event: 'receive_avatar',
                    data: this.avatar?.getBase64()
                }));
                break;
            default:
                console.log(`Unknown API message event: ${msg.event}`);
        }
    }
}

export default ChattyAPI;