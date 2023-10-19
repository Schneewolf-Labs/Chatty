const difflib = require('difflib');

class RepetitionTracker {
	constructor(threshold, history) {
		this.threshold = threshold;
		this.history = history;
	}

	isRepetitive = (message) => {
		for (let i = 0; i < this.history.length; i++) {
			let similarity = difflib.SequenceMatcher(null, message, this.history[i]).ratio();
			if (similarity >= this.threshold) {
				return true;
			}
		}
		return false;
	}	
}

module.exports = RepetitionTracker;