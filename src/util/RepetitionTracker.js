const difflib = require('difflib');

class RepetitionTracker {
	constructor(threshold) {
		this.threshold = threshold;
	}

	isRepetitive(message, history) {
		for (let i = 0; i < history.length; i++) {
			let similarity = difflib.SequenceMatcher(null, message, history[i]).ratio();
			if (similarity >= this.threshold) {
				return true;
			}
		}
		return false;
	}
}

module.exports = RepetitionTracker;