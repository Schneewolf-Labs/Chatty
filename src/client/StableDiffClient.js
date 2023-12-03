const logger = require('../util/logger');
const fetch = require('node-fetch');
const EventEmitter = require('events');

class StableDiffClient extends EventEmitter {
    constructor(settings) {
        super();
        this.settings = settings;
        this.baseUrl = settings.baseUrl;
        this.requestParams = settings.requestParams;
        this.uri = this.baseUrl+"/sdapi/v1/";

        logger.debug(`Attempting to connect to StableDiff at ${this.baseUrl}`);
        // Check if Stable Diffusion is online
        fetch(this.baseUrl+'/app_id', {
            method: 'GET',
            headers: {
                'accept': 'application/json'
            }
        }).then(res => {
            if (res.ok) {
                logger.info("Connected to StableDiff");
                this.emit('ok');
            } else {
                logger.error("Could not connect to StableDiff");
            }
        }).catch(err => {
            logger.error("Could not connect to Automatic1111 StableDiffusion", err);
            this.emit('error', err);
        });
    }

    // returns a promise that resolves to an image encoded in base64
    txt2img(params) {
        const uri = this.uri+'txt2img';
        logger.debug(`Sending text to StableDiff: ${params.prompt}`);
        return fetch(uri, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify(params)
        }).then(res => {
            if (res.ok) {
                return res.json();
            } else {
                logger.error("Could not convert text to image: "+res.status+" "+res.statusText);
            }
        }).then(json => {
            return json.images[0];
        });
    }

    // returns a promise that resolves to a string
    img2txt(img) {
        const uri = this.uri+'interrogate';
        logger.debug(`Sending image to StableDiff for interrogation`);
        return fetch(uri, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify({
                "image": img,
                "model": "clip"
            })
        }).then(res => {
            if (res.ok) {
                return res.json();
            } else {
                logger.error("Could not convert image to text: "+res.status+" "+res.statusText);
            }
        }).then(json => {
            if (!json) return 'ERROR';
            return json['caption'];
        });
    }
}

module.exports = StableDiffClient;