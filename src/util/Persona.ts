import logger from './Logger';
import * as fs from 'fs';
import * as YAML from 'yaml';

interface PersonaData {
    name: string;
    context: string;
    greeting: string;
}

class Persona {
    public name: string;
    public directive: string;
    public greeting: string;
    public numTokens: number;

    constructor(personaFile: string) {
        try {
            const persona: PersonaData = YAML.parse(fs.readFileSync(personaFile, 'utf8'));
            this.name = persona.name;
            this.directive = persona.context;
            this.greeting = persona.greeting;
            // get number of tokens in directive
            const tokens = this.directive.split(' ');
            this.numTokens = tokens.length;
            logger.info('Loaded persona: ' + this.name + ' with ' + this.numTokens + ' token directive');

        } catch (e) {
            logger.error('Error loading persona file: ' + e);
            this.name = '';
            this.directive = '';
            this.greeting = '';
            this.numTokens = 0;
        }
    }

    insertName(text: string): string {
        // replace {NAME} with persona name
        return text.replaceAll('{NAME}', this.name);
    }
}

export default Persona;