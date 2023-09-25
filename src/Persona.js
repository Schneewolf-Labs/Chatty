const fs = require('fs');
const YAML = require('yaml');

class Persona {
    constructor(personaFile) {
        try {
            const persona = YAML.parse(fs.readFileSync(personaFile, 'utf8'));
            this.name = persona.name;
            this.directive = persona.context;
            console.info('Loaded persona: ' + this.name);
        } catch (e) {
            console.error('Error loading persona file: ' + e);
            this.name = '';
            this.directive = '';
        }
    }
}

module.exports = Persona;