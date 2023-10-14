# Chatty
A framework for connecting AI to chat services like Twitch and Discord.

![NikuNiku900 on Twitch, thanks to Chatty!](https://raw.githubusercontent.com/Schneewolf-Labs/Chatty/main/nikuscreen.png)

## Features
- Streams chat messages with tmi.js and Discord.js
- Profanity detection and sentiment analysis
- Oobabooga API integration
- Automatic1111 Stable Diffusion integration
- Voice synthesis (Windows only)
- Text, image, and audio file output for OBS
- API for managing and monitoring

## Installation
1. Install [Node.js](https://nodejs.org/en/download/)
2. Install [Git](https://git-scm.com/downloads)
3. Clone this repository: `git clone https://github.com/Schneewolf-Labs/Chatty.git`
4. Install dependencies: `npm install`
5. Setup your .env file (see below)
6. Run the bot: `npm start`

## .env file
The .env file is used to store your Twitch credentials and other settings. It should be located in the root directory of the project. It should look like this:
```
TWITCH_USERNAME=your_twitch_username
TWITCH_OAUTH_TOKEN=your_twitch_oauth_token
TWITCH_CHANNEL=your_twitch_channel
DISCORD_TOKEN=your_discord_token
```

## Persona File
The persona file is in the same YAML format that Oobabooga uses for characters. The default location for this `persona.yaml` in the root directory, but this can be changed in the `config.yml` file. The persona file should look like this:
```
name: Assistant
greeting: Hello! How may I assist you?
context: |
    I am an assistant AI, determined to offer the best service possible. 
```

## Voice Synthesis (TTS)
Chatty supports voice synthesis on Windows using the Windows Speech API via [WinTTS](https://github.com/Schneewolf-Labs/WinTTS-Stream). Install .NET 6.0 and point the `config.yml` to the WinTTS executable. You can also choose an output device via the config file.

## API
Chatty has a built-in API for managing and monitoring the bot. The API is disabled by default. To enable it, set `api.enabled` to `true` in the `config.yml` file. The API will be available at `http://localhost:3000` by default. You can change the port in the config file.

Messages should be formatted as JSON:
```
{
    "event": "send_message",
    "data": "Hey Chatty!"
}
```
Responses will be formatted similarly:
```
{
    "event": "recieve_message",
    "data": "It's nice to meet you!"
}
```