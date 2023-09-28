const fs = require('fs');
const YAML = require('yaml');

const config = YAML.parse(fs.readFileSync('./config.yml', 'utf8'));
if (config.output) console.log(config);

// Create an output directory if it doesn't exist
if (!fs.existsSync(config.output_dir)) {
    fs.mkdirSync(config.output_dir);
}

module.exports = config;