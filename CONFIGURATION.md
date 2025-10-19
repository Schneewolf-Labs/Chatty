# Configuration Guide

Chatty uses a YAML configuration file (`config.yml`) for all settings. This guide explains each configuration option in detail.

## Table of Contents

- [Basic Configuration](#basic-configuration)
- [Platform Settings](#platform-settings)
- [Message Processing](#message-processing)
- [Content Filtering](#content-filtering)
- [AI Integration](#ai-integration)
- [Image Generation](#image-generation)
- [Voice & Audio](#voice--audio)
- [API Settings](#api-settings)
- [Advanced Options](#advanced-options)

## Basic Configuration

### General Settings

```yaml
persona_file: "persona.yaml"  # Path to persona definition file
output_dir: "output"           # Directory for generated files (OBS integration)

config:
  output: false                 # Print config to console on startup

logger:
  level: "debug"                # Log level: "debug", "info", "warn", "error"
  pretty: true                  # Pretty-print logs (disable for production)
```

## Platform Settings

### Twitch Configuration

```yaml
twitch:
  enabled: false                # Enable Twitch integration
  chat-enabled: true            # Monitor Twitch chat
  reply-in-chat: false          # Send responses back to Twitch chat
```

**Environment Variables Required:**
```env
TWITCH_USERNAME=your_bot_username
TWITCH_OAUTH_TOKEN=oauth:your_token_here
TWITCH_CHANNEL=channel_to_join
```

**Getting a Twitch OAuth Token:**
1. Visit https://twitchapps.com/tmi/
2. Authorize your bot account
3. Copy the `oauth:` token (keep the `oauth:` prefix)

### Discord Configuration

```yaml
discord:
  enabled: true                      # Enable Discord integration
  chat-enabled: true                 # Monitor Discord messages
  reply-in-chat: true                # Send responses to Discord
  post-image-output: true            # Post generated images
  send-is-typing: true               # Show typing indicator
  channels: []                       # Specific channel IDs (empty = all channels)
  fallback-to-default-channel: false # Use default channel if specified channel fails
  default-channel: 0                 # Default channel ID
  allow-dms: true                    # Respond to direct messages
  dm-users: []                       # Specific user IDs for DM access (empty = all)
  allow-attachments: true            # Process image attachments
```

**Environment Variables Required:**
```env
DISCORD_TOKEN=your_discord_bot_token
```

**Setting Up Discord Bot:**
1. Visit [Discord Developer Portal](https://discord.com/developers/applications)
2. Create New Application
3. Go to "Bot" section and create bot
4. Enable "Message Content Intent" under Privileged Gateway Intents
5. Copy bot token
6. Invite bot using OAuth2 URL with "Send Messages" and "Read Message History" permissions

**Finding Channel IDs:**
1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click a channel and select "Copy ID"

## Message Processing

### Response Behavior

```yaml
messages:
  max-tokens: 1000                  # Maximum context window size
  response-interval: 3500           # Minimum milliseconds between responses
  chat-history-length: 8            # Number of messages to keep in context
  chat-max-batch-size: 4            # Maximum messages to respond to at once
  include-responses-in-history: true # Include bot's own responses in context

  # Wake Word Configuration
  require-wake-word: false          # Require wake word/mention to respond
  wake-words: []                    # List of wake words (e.g., ["bot", "@assistant"])

  # Selective Response Mode
  selective-responses: false        # Enable probabilistic responses
  base-response-chance: 0.75        # Minimum response probability (0.0-1.0)
  max-response-chance: 0.90         # Maximum response probability (0.0-1.0)

  # Repetition Detection
  block-repetitive-responses: true                # Prevent repetitive outputs
  throttle-history-on-repetitive-response: true   # Reduce context on repetition
  repetition-threshold: 0.70                      # Similarity threshold (0.0-1.0)

  # Attachment Processing
  block-while-processing-attachments: true # Wait for attachment processing
```

**Response Interval:** Time in milliseconds between bot responses. Prevents spam and allows conversation flow.

**Selective Responses:** When enabled, the bot uses logarithmic scaling based on time since last response to determine if it should reply. Useful for natural conversation flow in busy channels.

### Prompt Configuration

Chatty uses a template-based prompt system with placeholders:

```yaml
messages:
  include-datetime: true            # Include current date/time in prompts

  # Template placeholders:
  # {NAME} - Persona name
  # {DATE} - Current date
  # {TIME} - Current time
  # {DELIMITER} - Chat delimiter token

  datetime-prompt: "<|im_start|>system\nCurrent date and time: {DATE} {TIME}\n<|im_end|>\n"

  persona-prompt: "<|im_start|>system\nGiven the following character description...\n"

  prompt: "Context:\nYou are {NAME} and you are in a chat channel..."

  safety-prompt: "{NAME} should always be friendly and supportive..."

  limitations-prompt: "{NAME} does not have the ability to post links..."

  draw-available-prompt: "Users are able to request that {NAME} draw..."

  chat-history-prefix: "<|im_end|>\n<|im_start|>system\nThe following is the chat history..."

  new-chat-prefix: "<|im_start|>system\nBelow are the latest chat messages..."

  prompt-response-prefix: "<|im_start|>{NAME}\n"
```

**Note:** These prompts use ChatML format (`<|im_start|>`, `<|im_end|>`). Adjust for your LLM's expected format.

### Streaming Configuration

```yaml
messages:
  chunk-delimiters: ['.', '\n', '?', '!', ';', ':', '—']  # Chunk boundaries for streaming
  illegal-response-tokens: ['<', 'http', 'www', '![', '[', '#', '\', '/']  # Stop tokens
  chat-delimiter: "<|im_end|>"       # Message delimiter token
  chat-prefix: "<|im_start|>"        # Message prefix token
  response-expire-time: 30000        # File output expiration (ms)
  prune-history: false               # Auto-prune old messages from history
```

**Chunk Delimiters:** Characters that trigger chunk emission during streaming. Allows TTS to start speaking before full response completes.

**Illegal Response Tokens:** Tokens that trigger response abort. Prevents the bot from trying to post links or use markdown/HTML.

## Content Filtering

### Message Sanitization

```yaml
sanitizer:
  reject-profanity: false                # Block profane messages entirely
  profane-response: "I'm sorry, I don't respond to profanity."  # Response when blocked
  profanity-replacement: "Sorry, I can't use profanity."         # Replace profanity with this

  reject-negativity: false               # Block highly negative messages
  sentiment-threshold: -0.5              # Negativity threshold (-5.0 to 5.0)

  remove-actions: true                   # Remove *action* text
```

**Sentiment Threshold:** Messages with sentiment scores below this threshold are rejected. Scale is approximately:
- `> 2`: Very positive
- `0 to 2`: Positive
- `-2 to 0`: Negative
- `< -2`: Very negative

## AI Integration

### Oobabooga Configuration

```yaml
oobabooga:
  baseUrl: "http://127.0.0.1:5000"  # Oobabooga API endpoint
  requestParams:                     # Additional API parameters
    max_tokens: 512                  # Max tokens to generate
    auto_max_new_tokens: false       # Auto-calculate max tokens
  output_responses: true             # Write responses to file
  output_location: "output/response.txt"  # Response file path
```

**Supported Request Parameters:**
- `max_tokens` - Maximum tokens to generate
- `temperature` - Randomness (0.0-2.0, default: 0.7)
- `top_p` - Nucleus sampling (0.0-1.0)
- `top_k` - Top-k sampling
- `repetition_penalty` - Penalize repetition (1.0-1.5)
- `typical_p` - Typical sampling
- `do_sample` - Enable sampling

See [Oobabooga API docs](https://github.com/oobabooga/text-generation-webui/wiki/12-%E2%80%90-OpenAI-API) for all parameters.

## Image Generation

### Stable Diffusion Configuration

```yaml
stable_diffusion:
  enabled: true                              # Enable image generation
  trigger: "draw "                           # Trigger phrase (e.g., "draw a cat")
  baseUrl: "http://127.0.0.1:7860"           # Automatic1111 API endpoint

  negative_prompt: "EasyNegative, lewd..."   # Default negative prompt

  requestParams: {}                          # Additional txt2img parameters

  output_location: "output/drawing.png"      # Generated image path
  prompt_output_location: "output/prompt.txt"              # Current prompt path
  next_prompt_output_location: "output/nextprompt.txt"     # Next prompt path
  next_prompt_output_prefix: " Next prompt: "              # Prefix for next prompt

  max_prompt_length: 512                     # Max characters in prompt

  banned_tokens: ['lewd', 'nude', 'sex'...]  # Blocked words in prompts
  rejected_response: "Sorry I can't draw that!"  # Response when prompt blocked

  enable_img2txt: true                       # Enable image captioning
  truncate_captions: true                    # Truncate long captions
```

**Request Parameters:** See [Automatic1111 API docs](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API) for supported parameters like `steps`, `cfg_scale`, `width`, `height`, `sampler_name`, etc.

## Voice & Audio

### Text-to-Speech

```yaml
voice:
  enabled: false                    # Enable TTS
  tts: "XTTS"                       # TTS engine: "XTTS" or "WinTTS"
  output_location: "output/"        # Audio file output directory
  alphanumeric_only: true           # Strip non-alphanumeric characters
  block_responses: true             # Block new responses while speaking
  max-speak-duration: 30000         # Maximum TTS duration (ms)
```

#### XTTS Configuration

```yaml
  xtts:
    url: "http://127.0.0.1:8020"    # XTTS API endpoint
    speaker: "alpha"                 # Speaker/voice name
    language: "en"                   # Language code
    sample_rate: 24000               # Audio sample rate (Hz)
    bit_depth: 16                    # Audio bit depth
    channels: 1                      # Audio channels (1=mono, 2=stereo)
    output_device: null              # Audio output device ID (null=default)
```

#### WinTTS Configuration (Windows Only)

```yaml
  wintts:
    voice_index: 1                   # Windows voice index (0-based)
    audio_device: 2                  # Audio output device index
    exe_location: "path/to/WinTTS-Stream.exe"  # WinTTS executable path
```

**Requirements:**
- XTTS: [XTTS Server](https://github.com/daswer123/xtts-api-server)
- WinTTS: [WinTTS-Stream](https://github.com/Schneewolf-Labs/WinTTS-Stream) + .NET 6.0

### Speech-to-Text (Whisper)

```yaml
whisper:
  enabled: false                                   # Enable STT
  exe_location: "path/to/stream.exe"               # Whisper executable
  model_location: "path/to/ggml-model.bin"         # Model file
  audio_device: 3                                  # Input device index
  file_output: "output/whisper.txt"                # Transcription output
```

**Requirements:**
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
- Compiled `stream` executable
- Downloaded model file (ggml format)

## API Settings

### REST API Configuration

```yaml
api:
  enabled: true    # Enable REST API
  port: 3000       # API port
```

**API Endpoints:**
- `POST /` - Send message to bot
- More endpoints documented in [API_REFERENCE.md](./API_REFERENCE.md)

## Advanced Options

### HTTP Content Analysis

```yaml
http:
  enabled: true          # Enable HTTP content fetching
  analyze-links: true    # Extract and analyze link content
  analyze-images: true   # Analyze images from URLs
  allow-downloading: true # Allow downloading content
```

### Avatar Configuration

```yaml
avatar:
  enable: false          # Enable avatar image
  location: "./avatar.png"  # Path to avatar image file
```

Avatar is converted to base64 and can be used in multimodal prompts.

## Example Configurations

### Twitch Streaming Bot

```yaml
twitch:
  enabled: true
  chat-enabled: true
  reply-in-chat: true

discord:
  enabled: false

messages:
  require-wake-word: true
  wake-words: ["@bot", "hey bot"]
  selective-responses: false
  max-tokens: 500
  response-interval: 5000

voice:
  enabled: true
  tts: "XTTS"
```

### Discord Community Bot

```yaml
twitch:
  enabled: false

discord:
  enabled: true
  chat-enabled: true
  reply-in-chat: true
  send-is-typing: true
  allow-dms: true
  channels: []  # Respond in all channels

messages:
  selective-responses: true
  base-response-chance: 0.3
  max-response-chance: 0.8
  require-wake-word: false

stable_diffusion:
  enabled: true
```

### Private Assistant

```yaml
discord:
  enabled: true
  allow-dms: true
  dm-users: ["123456789"]  # Specific user ID

messages:
  require-wake-word: false
  response-interval: 1000
  max-tokens: 2000

voice:
  enabled: true
  block_responses: true

whisper:
  enabled: true
```

## Troubleshooting

### Common Issues

**Bot not responding:**
- Check `enabled` flags for platforms
- Verify `chat-enabled: true`
- Check `require-wake-word` setting
- Verify API endpoints are accessible
- Check logs for errors

**Rate limiting:**
- Increase `response-interval`
- Enable `selective-responses`
- Reduce `chat-max-batch-size`

**High token usage:**
- Reduce `max-tokens`
- Reduce `chat-history-length`
- Set `include-responses-in-history: false`
- Enable `prune-history: true`

**TTS not working:**
- Verify TTS server is running
- Check `exe_location` paths
- Verify audio device indices
- Check `enabled: true` for voice

## Configuration Validation

Run with `config.output: true` to verify configuration is loaded correctly:

```yaml
config:
  output: true
```

This will print the parsed configuration on startup.

---

For more information, see:
- [README.md](./README.md) - General documentation
- [API_REFERENCE.md](./API_REFERENCE.md) - API documentation
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guide
