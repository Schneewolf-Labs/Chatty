const logger = require('../util/Logger');
const ResponseHandler = require('./ResponseHandler');
const MessageManager = require('./MessageManager');
const MessageSanitizer = require('./MessageSanitizer');

class ChatHandler {
    constructor(config, persona) {
        this.config = config;
        this.responseHandler = new ResponseHandler(config, persona);
        this.messageManager = new MessageManager(config.messages, this.responseHandler);
        this.sanitizer = new MessageSanitizer(config.sanitizer);
        this.chatServices = [];

        // If stable diffusion is enabled, initialize a draw manager and attach to message manager
        if (config.stable_diffusion.enabled === true) {
            const StableDiffClient = require('../client/StableDiffClient');
            const stableDiffClient = new StableDiffClient(config.stable_diffusion);
            const DrawManager = require('../draw/DrawManager');
            const drawManager = new DrawManager(stableDiffClient);
            drawManager.on('image', (image) => {
                this.chatServices.forEach((service) => {
                    service.sendImage(image);
                });
            });
            this.messageManager.setDrawManager(drawManager);
        }

        // Send responses to all registered chat services
        this.messageManager.on('response', (response) => {
            // Ensure the response is just the persona's
            response = this.sanitizer.trimResponse(response);
            // Remove links and other garbage
            response = this.sanitizer.sanitize(response);
            // Check if the message should be rejected
            if (this.sanitizer.shouldReject(response)) {
                logger.warn(`Response from Oobabooga was rejected`);
                // Replace the profane message and remove the response from the speech output buffer
                response = this.config.sanitizer['profanity-replacement'];
                // FIXME: the voice handler has probably already spoken at this point lol
                //this.responseHandler.voiceHandler.speechBuffer = message;
            }
            this.chatServices.forEach((service) => {
                service.sendMessage(response);
            });
        });
    }

    registerChatService(service) {
        this.chatServices.push(service);
        service.on('message', (message) => {
            const isProfane = this.sanitizer.shouldReject(message.text);
            if (isProfane) {
                logger.info(`rejected message from ${message.username}`);
                return;
            }
            this.messageManager.receiveMessage(message);
        });
    }
}

module.exports = ChatHandler;