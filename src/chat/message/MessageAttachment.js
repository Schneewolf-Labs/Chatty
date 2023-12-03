const crypto = require('crypto');

class MessageAttachment {
		constructor(message, url) {
				this.type = 'image';
				this.message = message;
				this.url = url;
				this.hash = crypto.createHash('sha256').update(url).digest('hex');
				this.data = null;
				this.caption = '';
		}
}

module.exports = MessageAttachment;