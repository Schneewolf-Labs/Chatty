class MessageAttachment {
	public type: string;
	public message: any;
	public url: string;
	public data: any;
	public caption: string;
	public processing: boolean;

	constructor(message: any, url: string) {
		this.type = 'image';
		this.message = message;
		this.url = url;
		this.data = null;
		this.caption = '';
		this.processing = false;
	}
}

export default MessageAttachment;