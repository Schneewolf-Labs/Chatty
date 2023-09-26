const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class DrawManager extends EventEmitter{
    constructor(stableDiffClient) {
        super();
        this.stableDiffClient = stableDiffClient;
        this.settings = stableDiffClient.settings;
        this.drawQueue = [];
        this.isDrawing = false;

        this.on('image', image => {
            console.log('DrawManager recieved image');
            // save image to output
            const filename = path.join(process.cwd(), this.settings.output_location);
            fs.writeFileSync(filename, image, 'base64');
            //this.emit('image', image);
        });
    }

    draw(prompt) {
        console.info(`DrawManager enqueuing prompt: ${prompt}`);
        this.drawQueue.push(prompt);
        if (!this.isDrawing) {
            this.isDrawing = true;
            this._drawNext();
        }
    }

    _drawNext() {
        console.info(`DrawManager drawing next image`);
        if (this.drawQueue.length === 0) {
            this.isDrawing = false;
            return;
        }
        const prompt = this.drawQueue.shift();
        try {
            this.stableDiffClient.txt2img({
                prompt: prompt,
                negative_prompt: this.settings.negative_prompt,
                ...this.settings.requestParams
            }).then(image => {
                this.emit('image', image);
                this._drawNext();
            });
        } catch (err) {
            console.error("Error encountered while drawing image", err);
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
        const punctuation = ['.', ',', '?', '!'];
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
}

module.exports = DrawManager;