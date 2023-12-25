const logger = require('../util/logger');

class TTSInterface {
	constructor() {
	}

	speak(token, force=false) {
		logger.warn(`TTSInterface.speak() not implemented`);
	}

	isSpeaking() {
		return false;
	}
}

module.exports = TTSInterface;
