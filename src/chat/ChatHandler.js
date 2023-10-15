const logger = require('../util/logger');
const OobaClient = require('../client/OobaClient');
const ChatChannel = require('./ChatChannel');
const MessageSanitizer = require('./message/MessageSanitizer');
const ResponseHandler = require('./response/ResponseHandler');

class ChatHandler {
    constructor(config, persona) {
        this.config = config;
        this.ooba = new OobaClient(config.oobabooga);
        this.persona = persona;
        this.sanitizer = new MessageSanitizer(config.sanitizer, persona, config.messages['chat-delimiter']);
        this.responseHandler = new ResponseHandler(config, this.ooba, persona);
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

    registerChatService(service) {
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

    createChatChannel(channelID) {
        if (this.chatChannels[channelID]) {
            logger.warn(`Chat channel ${channelID} already exists`);
            return;
        }

        const chatChannel = new ChatChannel(channelID, this.config, this.ooba, this.responseHandler);
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
            chatChannel.responseHandler.addResponseToHistory(text, chatChannel.channelID);
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

    setVoiceService(voiceService) {
        this.voiceService = voiceService;
        // set voice service for all chat channels
        Object.values(this.chatChannels).forEach((chatChannel) => {
            chatChannel.setVoiceService(voiceService);
        });
    }
}

module.exports = ChatHandler;