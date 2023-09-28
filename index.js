require('dotenv').config(); // Load environment variables from .env file
const fs = require('fs');
const YAML = require('yaml');
const TwitchClient = require('./src/client/TwitchClient');
const OobaClient = require('./src/client/OobaClient');
const MessageManager = require('./src/chat/MessageManager');
const Persona = require('./src/chat/Persona');

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
    const StableDiffClient = require('./src/client/StableDiffClient');
    const stableDiffClient = new StableDiffClient(config.stable_diffusion);
    const DrawManager = require('./src/draw/DrawManager');
    const drawManager = new DrawManager(stableDiffClient);
    messageManager.setDrawManager(drawManager);
}

// If using Windows and voice is enabled, initialize voice synthesis
if (process.platform === 'win32' && config.voice.enabled === true) {
    const VoiceHandler = require('./src/tts/VoiceHandler');
    const voiceHandler = new VoiceHandler(config.voice);
    messageManager.setVoiceHandler(voiceHandler);
}

// Connect to Twitch
if (config.twitch.enabled === true) {
    const twitch = new TwitchClient( 
        process.env.TWITCH_USERNAME, 
        process.env.TWITCH_CHANNEL, 
        process.env.TWITCH_OAUTH_TOKEN,
        config.twitch);
    twitch.on('message', (message) => {
        if (config.twitch['chat-enabled']) messageManager.receiveMessage(message);
    });
    twitch.connect();
    // Send response to chat
    if (config.twitch['reply-in-chat']) {
        messageManager.on('response', (response) => {
            twitch.sendMessage(response);
        });
    }
}

// Connect to Discord
if (config.discord.enabled === true) {
    const DiscordClient = require('./src/client/DiscordClient');
    const discord = new DiscordClient(
        process.env.DISCORD_TOKEN,
        process.env.DISCORD_CHANNEL,
        config.discord);
    discord.on('message', (message) => {
        if (config.discord['chat-enabled']) messageManager.receiveMessage(message);
    });
    discord.connect();
    // Send response to chat
    if (config.discord['reply-in-chat']) {
        messageManager.on('response', (response) => {
            discord.sendMessage(response);
        });
    }
}