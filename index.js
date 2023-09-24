const env = require('dotenv').config();
const tmi = require('tmi.js');
const badwords = require('bad-words');
const filter = new badwords();

// Connect to Twitch:
const twitch = new tmi.Client({
    options: { debug: true },
    connection: {
        secure: true,
        reconnect: true
    },
    identity: {
        username: process.env.TWITCH_USERNAME,
        password: process.env.TWITCH_OAUTH_TOKEN
    },
    channels: [ process.env.TWITCH_CHANNEL ]
});
twitch.connect();

// Listen to Twitch chat:
twitch.on('message', (channel, tags, message, self) => {
    console.log(`${tags['display-name']}: ${message}`);
    if (self) return;
    if (filter.isProfane(message)) {
        twitch.say(channel, `@${tags.username}, please watch your language!`);
    }
});