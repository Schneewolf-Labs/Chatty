const process = require('process');
const logger = require('../util/logger');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const DrawImage = require('./DrawImage');
const DrawPrompt = require('./DrawPrompt');

class DrawManager extends EventEmitter{
    constructor(stableDiffClient) {
        super();
        this.stableDiffClient = stableDiffClient;
        this.settings = stableDiffClient.settings;
        this.drawQueue = [];
        this.isDrawing = false;

        this.on('image', image => {
            logger.debug('DrawManager recieved image');
            // save image to output
            const filename = path.join(process.cwd(), this.settings.output_location);
            fs.writeFileSync(filename, image.data, 'base64');
            fs.writeFileSync(this.settings.prompt_output_location, image.prompt, 'utf8');
            //this.emit('image', image);
        });
    }

    draw(prompt, channel = null) {
        if (this.shouldRejectPrompt(prompt)) {
            logger.warn(`DrawManager rejected prompt: ${prompt}`);
            return false;
        }

        logger.info(`DrawManager enqueuing prompt: ${prompt}`);
        const promptObj = new DrawPrompt(prompt);
        promptObj.channel = channel;
        this.drawQueue.push(promptObj);
        if (!this.isDrawing) {
            this.isDrawing = true;
            this._drawNext();
        }
        // emit enqueued prompt
        this.emit('prompt', prompt);
        return true;
    }

    _drawNext() {
        if (this.drawQueue.length === 0) {
            this.isDrawing = false;
            this._outputNextPrompt('');
            return;
        }
        logger.debug(`DrawManager drawing next image`);
        const prompt = this.drawQueue.shift();
        const promptText = prompt.prompt;
        try {
            //this.lastPrompt = prompt;
            // output this prompt as next prompt
            this._outputNextPrompt(this.settings.next_prompt_output_prefix + promptText);
            // Call Stable Diffusion API
            this.stableDiffClient.txt2img({
                prompt: promptText,
                negative_prompt: this.settings.negative_prompt,
                ...this.settings.requestParams
            }).then(image => {
                const drawImage = new DrawImage(image, promptText);
                drawImage.channel = prompt.channel;
                this.emit('image', drawImage);
                this._drawNext();
            });
        } catch (err) {
            logger.error("Error encountered while drawing image", err);
            this._drawNext();
        }
    }

    caption(attachment) {
        logger.debug('DrawManager captioning image...');
        const data = attachment.data;
        if (!data) {
            logger.error('DrawManager recieved attachment with no image data');
            return;
        }
        this.stableDiffClient.img2txt(data).then(caption => {
            logger.debug(`DrawManager recieved caption: ${caption} for image(${attachment.url})`);
            if (caption) {
                if (this.settings['truncate_captions']) {
                    // truncate to first comma (prevents adding hallucinated artists and too much info)
                    const commaIndex = caption.indexOf(',');
                    if (commaIndex !== -1) {
                        caption = caption.substring(0, commaIndex);
                    }
                }
                attachment.caption = caption;
                this.emit('caption', attachment);
            }
        });
    }

    extractPrompt(message) {
        // set message to lowercase
        message = message.toLowerCase();
        // check for trigger in the message
        const trigger = this.settings.trigger;
        const triggerIndex = message.indexOf(trigger);
        if (triggerIndex === -1) return null; // return null if trigger not found
        // extract between trigger and punctuation (if any) for prompt
        const punctuation = ['.', '?', '!'];
        let prompt = message.substring(triggerIndex+trigger.length); // remove everything before and including trigger
        // iterate through prompt and if punctuation is found, truncate message and use as prompt
        for (let i = 0; i < prompt.length; i++) {
            if (punctuation.includes(prompt[i])) {
                prompt = prompt.substring(0, i);
                break;
            }
        }
        // remove leading and trailing whitespace
        prompt = prompt.trim();
        // truncte prompt to max length
        prompt = prompt.substring(0, this.settings.max_prompt_length);

        return prompt;
    }

    shouldRejectPrompt(prompt) {
        const bannedTokens = this.settings.banned_tokens;
        // Convert the prompt to lowercase and split it into words
        const words = prompt.toLowerCase().split(/\W+/);
        // Check if any of the words in the prompt match the illegal tokens
        for (let word of words) {
            if (bannedTokens.includes(word)) {
                return true; // Found an illegal token
            }
        }
        return false;
    }

    _outputNextPrompt(text) {
        fs.writeFileSync(this.settings.next_prompt_output_location, text, 'utf8');
    }
}

module.exports = DrawManager;