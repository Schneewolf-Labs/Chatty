import logger from './Logger';
import * as levenshtein from 'fast-levenshtein';

interface ResponseHistory {
	getHistory(numResponses: number): string[];
}

class RepetitionTracker {
	private threshold: number;
	private numResponses: number;

	constructor(threshold: number, numResponses: number) {
		this.threshold = threshold;
		this.numResponses = numResponses;
	}

	isRepetitive(message: string, responseHistory: ResponseHistory): boolean {
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

export default RepetitionTracker;
