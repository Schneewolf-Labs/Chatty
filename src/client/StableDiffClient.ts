import logger from '../util/Logger';
import fetch from 'node-fetch';
import { EventEmitter } from 'events';

interface StableDiffSettings {
    baseUrl: string;
    requestParams: any;
    [key: string]: any;
}

interface Txt2ImgParams {
    prompt: string;
    [key: string]: any;
}

interface StableDiffResponse {
    images: string[];
}

interface InterrogateResponse {
    caption: string;
}

class StableDiffClient extends EventEmitter {
    private settings: StableDiffSettings;
    private baseUrl: string;
    private requestParams: any;
    private uri: string;

    constructor(settings: StableDiffSettings) {
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
        }).catch((err: any) => {
            logger.error("Could not connect to Automatic1111 StableDiffusion", err);
            this.emit('error', err);
        });
    }

    // returns a promise that resolves to an image encoded in base64
    txt2img(params: Txt2ImgParams): Promise<string> {
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
        }).then((json: StableDiffResponse) => {
            return json.images[0];
        });
    }

    // returns a promise that resolves to a string
    img2txt(img: string): Promise<string> {
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
        }).then((json: InterrogateResponse | null) => {
            if (!json) return 'ERROR';
            return json['caption'];
        });
    }
}

export default StableDiffClient;