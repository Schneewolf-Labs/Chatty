const logger = require('../util/logger');
const TTSInterface = require('./TTSInterface');
const Buffer = require('buffer').Buffer;
const portAudio = require('naudiodon');

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

		this.is_speaking = false;
		this.queue = [];

		this.player = new portAudio.AudioIO({
			outOptions: {
				channelCount: 1,
				sampleFormat: portAudio.SampleFormat16Bit,
				sampleRate: 24000,
				closeOnError: true
			}
		});
	}

	speak(token, force=false) {
		if (!force && this.is_speaking) {
			logger.debug(`XTTS is already speaking, enqueueing token: ${token}`);
			this.queue.push(token);
			return;
		}
		if (!token) {
			logger.warn(`XTTS received empty token`);
			this._dequeue();
			return;
		}
		token = token.trim();
		logger.info(`XTTS speaking: ${token}`);
		// strip non-alphanumeric (except puncutation) characters if enabled
		if (this.alphanumeric_only) {
			token = token.replace(/[^a-zA-Z0-9\s.,!?']/g, '');
		}
		if (!token) {
			logger.warn(`XTTS stripped token, skipping`);
			this._dequeue();
			return;
		}
		this.is_speaking = true;
		const data = JSON.stringify({
			speaker_wav: this.speaker,
			language: this.language,
			text: token
		});
		logger.debug(`Sending token to XTTS server: ${data}`);
		// Send a POST request to the XTTS server /tts_to_audio endpoint
		fetch(this.url+'/tts_to_audio', {
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
					const fs = require('fs');
					const path = require('path');
					//const filename = `${Date.now()}.wav`;
					const filepath = path.join(this.outputLocation);
					fs.writeFile(filepath, Buffer.from(buffer), (err) => {
						if (err) {
							logger.error(`Error writing audio file: ${err}`);
							this.is_speaking = false;
							this._dequeue();
							return;
						}
						// Play the audio file
						logger.debug(`Playing audio file: ${filepath}`);
						const rs = fs.createReadStream(filepath);
						rs.pipe(this.player);
						this.player.on('error', (err) => {
							logger.error(`Error playing audio: ${err}`);
							this.is_speaking = false;
							//this._dequeue();
						});
						this.player.on('finish', () => {
							logger.debug(`Finished playing audio`);
							this.is_speaking = false;
							//this._dequeue();
						});
						this.player.start();
					});
				}).catch(err => {
					logger.error(`Error reading audio data from XTTS server response: ${err}`);
					this.is_speaking = false;
					//this._dequeue();
				});
			} else {
				logger.error(`Error sending token to XTTS server: ${res.status} ${res.statusText}`);
			}
		}).catch(err => {
			logger.error(`Error sending token to XTTS server: ${err}`);
		});

	}

	isSpeaking() {
		return this.is_speaking;
	}
}

module.exports = XTTS;