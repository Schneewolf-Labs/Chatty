class ResponseToken {
    public token: string;
    public channel: string;

    constructor(token: string, channel: string) {
        this.token = token;
        this.channel = channel;
    }
}

export default ResponseToken;