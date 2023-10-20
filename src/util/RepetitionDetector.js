const logger = require('./logger');
const levenshtein = require('fast-levenshtein');

class RepetitionTracker {
	constructor(threshold, numResponses) {
		this.threshold = threshold;
		this.numResponses = numResponses;
	}

	isRepetitive(message, responseHistory) {
		logger.debug(`Checking if message is repetitive: ${message}`);
		const history = responseHistory.getHistory(this.numResponses);
		for (let i = 0; i < history.length; i++) {
			let distance = levenshtein.get(message, history[i]);
			let maxLength = Math.max(message.length, history[i].length);
			let similarity = 1 - (distance / maxLength);
			logger.debug(`similarity: ${similarity}`);
			if (similarity >= this.threshold) {
				return true;
			}
		}
		return false;
	}	
}

module.exports = RepetitionTracker;
