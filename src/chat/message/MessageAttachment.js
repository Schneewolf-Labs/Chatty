class MessageAttachment {
		constructor(message, url) {
				this.type = 'image';
				this.message = message;
				this.url = url;
				this.data = null;
				this.caption = '';
		}
}

module.exports = MessageAttachment;