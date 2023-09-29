require('dotenv').config(); // Load environment variables from .env file
const config = require('./src/util/Config'); // Load config file
const Chatty = require('./src/Chatty'); // Load Chatty class

// Initialize Chatty
const chatty = new Chatty(config);

// Connect to Twitch
if (config.twitch.enabled === true) {
    const TwitchClient = require('./src/client/TwitchClient');
    const twitch = new TwitchClient( 
        process.env.TWITCH_USERNAME, 
        process.env.TWITCH_CHANNEL, 
        process.env.TWITCH_OAUTH_TOKEN,
        config.twitch);
    chatty.registerChatService(twitch);
}

// Connect to Discord
if (config.discord.enabled === true) {
    const DiscordClient = require('./src/client/DiscordClient');
    const discord = new DiscordClient(
        process.env.DISCORD_TOKEN,
        process.env.DISCORD_CHANNEL,
        config.discord);
    chatty.registerChatService(discord);
}