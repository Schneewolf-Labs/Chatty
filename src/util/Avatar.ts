import * as fs from 'fs';

class Avatar {
	private fileLocation: string;
	private base64: string | null;

	constructor(fileLocation: string) {
		this.fileLocation = fileLocation;
		this.base64 = null;
		this._loadFile();
	}

	private _loadFile(): void {
		try {
			const file = fs.readFileSync(this.fileLocation);
			this.base64 = file.toString('base64');
		} catch (err) {
			console.log(`Error loading avatar file: ${err}`);
		}
	}

	getBase64(): string | null {
		return this.base64;
	}
}

export default Avatar;