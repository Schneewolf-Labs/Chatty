import * as fs from 'fs';
import * as YAML from 'yaml';

interface Config {
    output?: boolean;
    output_dir: string;
    persona_file: string;
    avatar: {
        enabled: boolean;
        location: string;
    };
    api: {
        enabled: boolean;
    };
    oobabooga: {
        output_responses: boolean;
    };
    voice: {
        enabled: boolean;
    };
    twitch: {
        enabled: boolean;
    };
    discord: {
        enabled: boolean;
    };
    [key: string]: any;
}

const config: Config = YAML.parse(fs.readFileSync('./config.yml', 'utf8'));
if (config.output) console.log(config);

// Create an output directory if it doesn't exist
if (!fs.existsSync(config.output_dir)) {
    fs.mkdirSync(config.output_dir);
}

export default config;