class OobaClient {
    constructor(url) {
        this.url = url;
        this.socket = null;
        this.connected = false;
    }
}

module.exports = OobaClient;