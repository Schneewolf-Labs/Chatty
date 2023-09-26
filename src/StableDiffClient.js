class StableDiffClient {
    constructor(settings) {
        this.settings = settings;
        this.baseUrl = settings.baseUrl;
        this.requestParams = settings.requestParams;
        this.uri = this.baseUrl+"/sdapi/v1/";

        console.log(`Attempting to connect to StableDiff at ${this.baseUrl}`);
        // Check if Stable Diffusion is online
        fetch(this.baseUrl+'/app_id', {
            method: 'GET',
            headers: {
                'accept': 'application/json'
            }
        }).then(res => {
            if (res.ok) {
                console.log("Connected to StableDiff");
            } else {
                console.error("Could not connect to StableDiff");
            }
        });
    }

    // returns a promise that resolves to an image encoded in base64
    txt2img(params) {
        const uri = this.uri+'txt2img';
        console.log(`Sending text to StableDiff: ${params.prompt}`);
        return fetch(uri, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify(params)
        }).then(res => {
            console.log(res);
            if (res.ok) {
                return res.json();
            } else {
                console.error("Could not convert text to image: "+res.status+" "+res.statusText);
            }
        }).then(json => {
            return json.images[0];
        });
    }
}

module.exports = StableDiffClient;