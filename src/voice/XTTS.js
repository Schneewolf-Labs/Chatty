const logger = require('../util/logger');
const TTSInterface = require('./TTSInterface');
const Buffer = require('buffer').Buffer;
const player = require('node-wav-player');
const fs = require('fs');
const path = require('path');

class XTTS extends TTSInterface {
	constructor(options) {
		super();
		this.options = options;
		this.url = options.xtts.url;
		this.speaker = options.xtts.speaker;
		this.language = options.xtts.language;
		this.outputLocation = options.output_location;
		this.alphanumeric_only = options.alphanumeric_only;
		this.maxDuration = options['max-speak-duration'];
		this.durationTimer = null;

		this.synthesizing = false;
		this.is_speaking = false;
		this.queue = [];
		this.playbackQueue = [];
	}

	speak(token, force = false) {
		if (!force && this.synthesizing) {
			logger.debug(`XTTS is already synthesizing, enqueueing token: ${token}`);
			this.queue.push(token);
			return;
		}
		if (!token) {
			logger.warn(`XTTS received empty token`);
			this._dequeue();
			return;
		}
		token = token.trim();
		logger.info(`XTTS synthesizing: ${token}`);
		// strip non-alphanumeric (except puncutation) characters if enabled
		if (this.alphanumeric_only) {
			token = token.replace(/[^a-zA-Z0-9\s.,!?']/g, '');
		}
		if (!token) {
			logger.warn(`XTTS stripped token, skipping`);
			this._dequeue();
			return;
		}
		// Set a timer to dequeue the next token if the current one takes too long
		// this.durationTimer = setTimeout(() => {
		// 	logger.warn(`WinTTS took too long to speak, dequeuing`);
		// 	this.is_speaking = false;
		// 	this._dequeue();
		// }, this.maxDuration);
		this.synthesizing = true;
		// Send the token to the XTTS server
		const data = JSON.stringify({
			speaker_wav: this.speaker,
			language: this.language,
			text: token
		});
		logger.debug(`Sending token to XTTS server: ${data}`);
		// Send a POST request to the XTTS server /tts_to_audio endpoint
		fetch(this.url + '/tts_to_audio', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: data
		}).then(res => {
			if (res.status === 200) {
				// Get the audio data from the response
				res.arrayBuffer().then(buffer => {
					// Write the audio data to a file
					const filename = `${Date.now()}.wav`;
					const filepath = path.join(this.outputLocation, filename);
					fs.writeFile(filepath, Buffer.from(buffer), (err) => {
						if (err) {
							logger.error(`Error writing audio file: ${err}`);
							this.synthesizing = false;
							this._dequeue();
							return;
						}
						this.playbackQueue.push(filepath);
						this._play();
						this.synthesizing = false;
						this._dequeue();
					});
				}).catch(err => {
					logger.error(`Error reading audio data from XTTS server response: ${err}`);
					this.synthesizing = false;
					this._dequeue();
				});
			} else {
				logger.error(`Error sending token to XTTS server: ${res.status} ${res.statusText}`);
				this.synthesizing = false;
				this._dequeue();
			}
		}).catch(err => {
			logger.error(`Error sending token to XTTS server: ${err}`);
			this.synthesizing = false;
			this._dequeue();
		});

	}

	isSpeaking() {
		return this.is_speaking;
	}

	_dequeue() {
		// if (this.durationTimer) clearTimeout(this.durationTimer);
		if (this.queue.length > 0) {
			const token = this.queue.shift();
			this.speak(token, true);
		} else {
			this.is_speaking = false;
		}
	}

	_play() {
		if (!this.is_speaking && this.playbackQueue.length > 0) {
			this.is_speaking = true;
			const filepath = this.playbackQueue.shift();
			logger.debug(`Playing audio file: ${filepath}`);
			player.play({
				path: filepath,
				sync: true
			}).then(() => {
				logger.debug(`Finished playing audio file: ${filepath}`);
				this.is_speaking = false;
				// delete the file
				fs.unlink(filepath, (err) => {
					if (err) {
						logger.error(`Error deleting audio file: ${err}`);
					}
				});
				// play the next file
				this._play();
			}).catch(err => {
				logger.error(`Error playing audio file: ${err}`);
				this._play();
			});
		}
	}
}

module.exports = XTTS;