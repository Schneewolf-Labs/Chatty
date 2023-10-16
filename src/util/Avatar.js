const fs = require('fs');

class Avatar {
	constructor(fileLocation) {
		this.fileLocation = fileLocation;
		this.base64 = null;
		this._loadFile();
	}

	_loadFile() {
		try {
			const file = fs.readFileSync(this.fileLocation);
			this.base64 = file.toString('base64');
		} catch (err) {
			console.log(`Error loading avatar file: ${err}`);
		}
	}

	getBase64() {
		return this.base64;
	}
}

module.exports = Avatar;