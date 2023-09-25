# Chatty
A framework for connecting AI to Twitch chat.

## Features
- Streams chat messages with tmi.js
- Profanity detection and sentiment analysis
- Oobabooga API integration
- Automatic1111 Stable Diffusion integration
- Voice synthesis (Windows only)
- Text, image, and audio file output for OBS
- API for managing and monitoring
- Integration with StreamLabs API

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
```