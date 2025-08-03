import logger from '../util/Logger';

abstract class TTSInterface {
	constructor() {
	}

	speak(token: string, force: boolean = false): void {
		logger.warn(`TTSInterface.speak() not implemented`);
	}

	isSpeaking(): boolean {
		return false;
	}
}

export default TTSInterface;
