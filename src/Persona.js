const fs = require('fs');
const YAML = require('yaml');

class Persona {
    constructor(personaFile) {
        try {
            const persona = YAML.parse(fs.readFileSync(personaFile, 'utf8'));
            this.name = persona.name;
            this.directive = persona.context;
            // get number of tokens in directive
            const tokens = this.directive.split(' ');
            this.numTokens = tokens.length;
            console.info('Loaded persona: ' + this.name + ' with ' + this.numTokens + ' token directive');

        } catch (e) {
            console.error('Error loading persona file: ' + e);
            this.name = '';
            this.directive = '';
        }
    }

    insertName(text) {
        // replace {NAME} with persona name
        return text.replace('{NAME}', this.name);
    }
}

module.exports = Persona;