const process = require('process');
const logger = require('../util/logger');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const DrawImage = require('./DrawImage');

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

    draw(prompt) {
        logger.info(`DrawManager enqueuing prompt: ${prompt}`);
        this.drawQueue.push(prompt);
        if (!this.isDrawing) {
            this.isDrawing = true;
            this._drawNext();
        }
    }

    _drawNext() {
        if (this.drawQueue.length === 0) {
            this.isDrawing = false;
            this._outputNextPrompt('');
            return;
        }
        logger.debug(`DrawManager drawing next image`);
        const prompt = this.drawQueue.shift();
        try {
            //this.lastPrompt = prompt;
            // output this prompt as next prompt
            this._outputNextPrompt(this.settings.next_prompt_output_prefix + prompt);
            // Call Stable Diffusion API
            this.stableDiffClient.txt2img({
                prompt: prompt,
                negative_prompt: this.settings.negative_prompt,
                ...this.settings.requestParams
            }).then(image => {
                this.emit('image', new DrawImage(image, prompt));
                this._drawNext();
            });
        } catch (err) {
            logger.error("Error encountered while drawing image", err);
            this._drawNext();
        }
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
        return prompt;
    }

    _outputNextPrompt(text) {
        fs.writeFileSync(this.settings.next_prompt_output_location, text, 'utf8');
    }
}

module.exports = DrawManager;