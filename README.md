# Discord PMO Bot

A self-hosted Discord bot that **transcribes voice meetings** using local AI (whisper.cpp), **sends recurring meeting reminders**, and **tracks tasks** with auto-detection from transcriptions. No paid APIs, no cloud dependencies — everything runs on your machine.

## Features

### Voice Transcription
- Join any voice channel and get live transcriptions posted to a text channel
- Powered by [whisper.cpp](https://github.com/ggerganov/whisper.cpp) (medium model) — runs locally, supports multiple languages
- Per-user audio buffering with automatic silence detection
- Full timestamped transcript posted when the session ends
- **Meeting minutes file** — `/transcribe stop` creates a markdown file in `transcripts/` (configurable) and optionally attaches it to Discord
- No audio stored permanently — temp files are deleted immediately

### Meeting Reminders
- Create recurring schedules for any combination of days and times
- Configurable reminder offset per schedule (default: 30 minutes before)
- Optional role mentions to ping the right people
- All times in Philippine Time (Asia/Manila)

### Task Management
- Create, edit, view, and track tasks with 5 statuses (To Do → In Progress → In Review → Done → Cancelled)
- 4 priority levels: Low, Medium, High, Critical
- **Auto-detection:** Action items spoken during voice transcription are detected and offered as tasks via confirmation buttons
- Paginated task list with filters (assignee, status, priority)
- Recurring check-in reminders (daily/weekly) that post open tasks grouped by assignee with overdue highlighting
- Soft delete — cancelled tasks are preserved in the database

## Slash Commands

| Command | Description |
|---------|-------------|
| `/transcribe start` | Bot joins your voice channel and starts transcribing |
| `/transcribe stop` | Bot stops, saves meeting minutes to a file, posts full transcript, and leaves |
| `/schedule set <days> <time> <channel> [reminder] [mention]` | Create a recurring meeting schedule |
| `/schedule list` | Show all schedules for this server |
| `/schedule edit <id> [fields...]` | Update specific fields of a schedule |
| `/schedule remove <id>` | Delete a schedule |
| `/task create <title> <assignee> [priority] [due_date] [description]` | Create a new task |
| `/task list [assignee] [status] [priority]` | List tasks with optional filters |
| `/task edit <id> [fields...]` | Update task fields |
| `/task status <id> <new_status>` | Quick status change |
| `/task view <id>` | View detailed task info |
| `/task delete <id>` | Cancel a task (soft delete) |
| `/task-reminder set <frequency> <time> <channel> [days]` | Set a recurring task check-in |
| `/task-reminder list` | Show all task reminders |
| `/task-reminder remove <id>` | Remove a task reminder |

## Prerequisites

- **Node.js** v18+
- **whisper.cpp** — compiled with the medium model (~1.5 GB)
- A **Discord Bot** application with the required intents and permissions

## Setup

### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application
2. Under the **Bot** tab, reset and copy the bot token
3. Enable **Privileged Gateway Intents**: `Server Members Intent` (required for voice transcription; `Message Content Intent` is not needed)
4. Under **OAuth2 > URL Generator**, select scopes: `bot`, `applications.commands`
5. Select bot permissions: `Connect`, `Speak`, `Send Messages`, `Embed Links`, `Attach Files`, `Mention Everyone`
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

# Optional: TRANSCRIPTS_DIR=./transcripts  (where meeting minutes are saved)
# Optional: GUILD_ID=your-server-id        (for faster slash command registration)
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
│   │   ├── schedule.js       # /schedule set|edit|list|remove
│   │   ├── task.js           # /task create|list|edit|status|view|delete
│   │   └── taskReminder.js   # /task-reminder set|list|remove
│   ├── services/
│   │   ├── database.js       # SQLite CRUD (better-sqlite3)
│   │   ├── scheduler.js      # Cron-based reminder engine
│   │   ├── taskDetector.js   # Action item detection & confirmation flow
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

## Testing

```bash
npm test
```

Runs the unit test suite (Vitest).

## Usage

- Quick usage guide: `docs/USAGE.md`
- Command reference: `docs/COMMANDS.md`
- Deployment/troubleshooting: `docs/DEPLOYMENT.md`

## Privacy

- A consent notice is posted when transcription starts
- No audio is stored permanently — only in memory during the session
- Transcription text is posted to Discord and saved as markdown files in `transcripts/` (configurable)
- Everything runs locally — no data leaves your machine except to Discord's API

## License

ISC
