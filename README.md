# Discord PMO Bot

A self-hosted Discord bot that **transcribes voice meetings** using local AI (whisper.cpp) and **sends recurring meeting reminders**. No paid APIs, no cloud dependencies — everything runs on your machine.

## Features

### Voice Transcription
- Join any voice channel and get live transcriptions posted to a text channel
- Powered by [whisper.cpp](https://github.com/ggerganov/whisper.cpp) (medium model) — runs locally, supports multiple languages
- Per-user audio buffering with automatic silence detection
- Full timestamped transcript posted when the session ends
- No audio stored permanently — temp files are deleted immediately

### Meeting Reminders
- Create recurring schedules for any combination of days and times
- Configurable reminder offset per schedule (default: 30 minutes before)
- Optional role mentions to ping the right people
- All times in Philippine Time (Asia/Manila)

## Slash Commands

| Command | Description |
|---------|-------------|
| `/transcribe start` | Bot joins your voice channel and starts transcribing |
| `/transcribe stop` | Bot stops, posts full transcript, and leaves |
| `/schedule set <days> <time> <channel> [reminder] [mention]` | Create a recurring meeting schedule |
| `/schedule list` | Show all schedules for this server |
| `/schedule edit <id> [fields...]` | Update specific fields of a schedule |
| `/schedule remove <id>` | Delete a schedule |

## Prerequisites

- **Node.js** v18+
- **whisper.cpp** — compiled with the medium model (~1.5 GB)
- A **Discord Bot** application with the required intents and permissions

## Setup

### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application
2. Under the **Bot** tab, reset and copy the bot token
3. Enable **Privileged Gateway Intents**: `Server Members Intent` and `Message Content Intent`
4. Under **OAuth2 > URL Generator**, select scopes: `bot`, `applications.commands`
5. Select bot permissions: `Connect`, `Speak`, `Send Messages`, `Embed Links`, `Mention Everyone`
6. Open the generated URL to invite the bot to your server

### 2. Install whisper.cpp

```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
cmake -B build
cmake --build build --config Release

# Download the medium model
./models/download-ggml-model.sh medium
```

### 3. Install and configure the bot

```bash
git clone https://github.com/patriki28/discord-pmo-bot.git
cd discord-pmo-bot
npm install
```

Copy `.env.example` to `.env` and fill in your values:

```env
DISCORD_TOKEN=your-bot-token-here
DISCORD_CLIENT_ID=your-client-id-here
WHISPER_CPP_PATH=C:/path/to/whisper.cpp/build/bin/Release/whisper-cli.exe
WHISPER_MODEL_PATH=C:/path/to/whisper.cpp/models/ggml-medium.bin
```

### 4. Register slash commands and start

```bash
npm run deploy   # Register slash commands with Discord
npm start        # Start the bot
```

## Project Structure

```
discord-pmo-bot/
├── src/
│   ├── index.js              # Bot entry point
│   ├── config.js             # Env loader & validation
│   ├── commands/
│   │   ├── deploy.js         # Slash command registration
│   │   ├── transcribe.js     # /transcribe start|stop
│   │   └── schedule.js       # /schedule set|edit|list|remove
│   ├── services/
│   │   ├── database.js       # SQLite CRUD (better-sqlite3)
│   │   ├── scheduler.js      # Cron-based reminder engine
│   │   ├── voice.js          # Voice connection & audio streams
│   │   └── transcription.js  # whisper.cpp integration
│   └── utils/
│       └── audio.js          # PCM buffering & WAV conversion
├── docs/
│   └── PRD.md                # Product requirements document
└── data/                     # SQLite DB (created at runtime)
```

## Tech Stack

| Component | Choice |
|-----------|--------|
| Runtime | Node.js (ES Modules) |
| Bot Framework | discord.js v14 |
| Voice | @discordjs/voice + prism-media + opusscript |
| Speech-to-Text | whisper.cpp (medium model, local) |
| Database | SQLite via better-sqlite3 |
| Scheduling | node-cron |

## Privacy

- A consent notice is posted when transcription starts
- No audio is stored permanently — only in memory during the session
- Transcriptions are posted to Discord only, not saved to the database
- Everything runs locally — no data leaves your machine except to Discord's API

## License

ISC
