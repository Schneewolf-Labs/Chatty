class DrawPrompt {
    public prompt: string;
    public channel: string | null;

    constructor(prompt: string) {
        this.prompt = prompt;
        this.channel = null;
    }
}

export default DrawPrompt;