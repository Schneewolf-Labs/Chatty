require('dotenv').config(); // Load environment variables from .env file
const fs = require('fs');
const YAML = require('yaml');
const TwitchClient = require('./src/TwitchClient');
const OobaClient = require('./src/OobaClient');
const MessageManager = require('./src/MessageManager');
const Persona = require('./src/Persona');

// Load Config
const config = YAML.parse(fs.readFileSync('./config.yml', 'utf8'));
console.log(config);

// Create an output directory if it doesn't exist
if (!fs.existsSync(config.output_dir)) {
    fs.mkdirSync(config.output_dir);
}

// Load the AI's persona
const persona = new Persona(config.persona_file);

// Connect to Oobabooga
const ooba = new OobaClient(config.oobabooga);

// Initialize message manager
const messageManager = new MessageManager(ooba, persona, config.messages);

// If stable diffusion is enabled, initialize a draw manager and attach to message manager
if (config.stable_diffusion.enabled === true) {
    const StableDiffClient = require('./src/StableDiffClient');
    const stableDiffClient = new StableDiffClient(config.stable_diffusion);
    const DrawManager = require('./src/DrawManager');
    const drawManager = new DrawManager(stableDiffClient);
    messageManager.setDrawManager(drawManager);
}

// If using Windows and voice is enabled, initialize voice synthesis
if (process.platform === 'win32' && config.voice.enabled === true) {
    const VoiceHandler = require('./src/VoiceHandler');
    const voiceHandler = new VoiceHandler(config.voice);
    messageManager.setVoiceHandler(voiceHandler);
}

// Connect to Twitch
const twitch = new TwitchClient(messageManager, 
    process.env.TWITCH_USERNAME, 
    process.env.TWITCH_CHANNEL, 
    process.env.TWITCH_OAUTH_TOKEN);
twitch.connect();