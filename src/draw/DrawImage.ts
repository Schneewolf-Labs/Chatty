class DrawImage {
    public data: any;
    public prompt: string | null;
    public channel: string | null;

    constructor(data: any, prompt: string | null = null) {
        this.data = data;
        this.prompt = prompt;
        this.channel = null;
    }
}

export default DrawImage;