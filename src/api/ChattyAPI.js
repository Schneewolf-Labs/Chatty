const logger = require('../util/logger');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const APIChatService = require('./APIChatService');

class ChattyAPI {
    constructor(chatty) {
        this.chatty = chatty;
        this.config = chatty.config;
        this.chatService = new APIChatService(this);
        chatty.registerChatService(this.chatService);

        this.port = this.config.api.port;
        this.app = express();
        this.httpServer = http.createServer(this.app);
        this.wss = new WebSocket.Server({ 
            server: this.httpServer
        });
        this.wss.on('connection', (ws) => {
            ws.on('message', (message) => {
                this._handleAPIMessage(ws, message);
            });
            ws.send('WebSocket connection established');
        });
    }

    start() {
        this.httpServer = this.app.listen(this.port, () => {
            logger.info(`Chatty API listening on port ${this.port}`);
        });
    }

    stop() {
        this.server.close();
    }

    receiveMessage(message) {
        // receive message from api user
        this.chatService.emit('message', message);
    }

    sendMessage(client, message) {
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

    broadcastMessage(message) {
        // broadcast a message to all connected clients
        this.wss.clients.forEach((client) => {
            this.sendMessage(client, message);
        });
    }

    sendImage(client, image) {
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

    broadcastImage(image) {
        // broadcast an image to all connected clients
        this.wss.clients.forEach((client) => {
            this.sendImage(client, image);
        });
    }

    sendTyping(client) {
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

    broadcastTyping() {
        // broadcast a typing indicator to all connected clients
        this.wss.clients.forEach((client) => {
            this.sendTyping(client);
        });
    }

    _handleAPIMessage(ws, message) {
        // Handle incoming messages from the API here
        const msg = JSON.parse(message);
        switch (msg.event) {
            case 'send_message':
                var chatmsg = msg.data;
                chatmsg.reply = (response) => {
                    this.sendMessage(ws, response);
                };
                this.receiveMessage(chatmsg);
                break;
            default:
                console.log(`Unknown API message event: ${msg.event}`);
        }
    }
}

module.exports = ChattyAPI;