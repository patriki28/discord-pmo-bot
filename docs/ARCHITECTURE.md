# Architecture

## Overview

Discord PMO Bot is a single-process Node.js application using discord.js v14. It connects to Discord's gateway, handles slash commands and component interactions, and runs background cron jobs for reminders.

## Module Responsibilities

```
src/
  index.js              Entry point — client setup, interaction routing
  config.js             Validates and exports env vars (token, client ID, whisper paths)
  commands/
    transcribe.js       /transcribe start|stop — voice session lifecycle
    schedule.js         /schedule set|list|edit|remove — meeting reminder CRUD
    task.js             /task create|list|edit|status|view|delete — task CRUD + pagination
    taskReminder.js     /task-reminder set|list|remove — check-in reminder CRUD
    deploy.js           Registers slash commands with Discord API (run separately)
  services/
    voice.js            VoiceSession class — joins channel, captures audio, flushes transcriptions
    transcription.js    Shells out to whisper-cli, manages temp WAV files
    database.js         SQLite via better-sqlite3 — all CRUD operations
    scheduler.js        Cron-based reminder engine (meetings + task check-ins)
    taskDetector.js     Regex pattern matching on transcript text, confirmation UI
  utils/
    audio.js            PCM buffering (UserAudioBuffer) and WAV header construction
```

## Data Flow

### Voice Transcription

```mermaid
sequenceDiagram
    participant User
    participant Discord
    participant Bot as index.js
    participant VS as voice.js
    participant T as transcription.js
    participant TD as taskDetector.js
    participant DB as database.js

    User->>Discord: /transcribe start
    Discord->>Bot: Interaction
    Bot->>VS: new VoiceSession()
    VS->>Discord: Join voice channel
    VS->>VS: Subscribe to speaking events

    loop On speech end
        VS->>T: transcribe(pcmBuffer, username)
        T->>T: PCM → WAV → whisper-cli → text
        T-->>VS: { username, text, timestamp }
        VS->>Discord: Post transcription line
        VS->>TD: scan(text, guild)
        TD-->>VS: candidates[]
        VS->>Discord: Post task confirmation embeds
    end

    User->>Discord: /transcribe stop
    Bot->>VS: session.stop()
    VS->>Discord: Post full timestamped transcript
    VS->>Discord: Destroy connection
```

### Meeting Reminders

```mermaid
sequenceDiagram
    participant Cron as scheduler.js
    participant DB as database.js
    participant Discord

    loop Every minute
        Cron->>DB: getAllSchedules()
        DB-->>Cron: schedules[]
        Cron->>Cron: Check day + time match
        Cron->>Cron: Dedup via sentReminders Set
        Cron->>Discord: Send reminder message
    end
```

### Task Check-In Reminders

```mermaid
sequenceDiagram
    participant Cron as scheduler.js
    participant DB as database.js
    participant Discord

    loop Every minute
        Cron->>DB: getAllTaskReminders()
        DB-->>Cron: reminders[]
        Cron->>Cron: Check frequency + day + time match
        Cron->>DB: getOpenTasksByGuild(guildId)
        DB-->>Cron: tasks[]
        Cron->>Cron: Group by assignee, flag overdue
        Cron->>Discord: Post check-in embed
    end
```

## In-Memory State

The bot maintains four in-memory structures. All are lost on restart.

| Variable | Location | Type | Key | TTL | Purpose |
|----------|----------|------|-----|-----|---------|
| `sessions` | `voice.js` | `Map<guildId, VoiceSession>` | Guild ID | Session lifetime | Active transcription sessions (max 1 per guild) |
| `paginationState` | `task.js` | `Map<messageId, { filters, page, total }>` | Message ID | 10 minutes | Preserves list filters across page navigation |
| `pendingCandidates` | `taskDetector.js` | `Map<candidateId, candidateData>` | UUID | 5 minutes | Detected tasks awaiting user confirmation |
| `sentReminders` | `scheduler.js` | `Set<string>` | `{id}-{date}-{timestamp}` | 24 hours | Deduplication for reminder sends |

## Database Schema

SQLite with WAL mode. Database file: `data/bot.db`.

```mermaid
erDiagram
    schedules {
        INTEGER id PK
        TEXT guild_id
        TEXT channel_id
        TEXT days
        TEXT time
        INTEGER reminder_minutes
        TEXT mention_role
        TEXT created_by
        DATETIME created_at
    }

    tasks {
        INTEGER id PK
        TEXT guild_id
        TEXT channel_id
        TEXT title
        TEXT description
        TEXT assignee_id
        TEXT created_by
        TEXT status
        TEXT priority
        TEXT due_date
        TEXT source
        DATETIME created_at
        DATETIME updated_at
    }

    task_reminders {
        INTEGER id PK
        TEXT guild_id
        TEXT channel_id
        TEXT frequency
        TEXT time
        TEXT days
        TEXT created_by
        DATETIME created_at
    }
```

### Column Notes

- **tasks.status**: `todo` | `in_progress` | `in_review` | `done` | `cancelled`
- **tasks.priority**: `low` | `medium` | `high` | `critical`
- **tasks.source**: `manual` (slash command) | `auto` (transcript detection)
- **schedules.days**: Comma-separated lowercase day names (e.g., `monday,wednesday,friday`)
- **task_reminders.frequency**: `daily` | `weekly`
- **task_reminders.days**: Comma-separated (weekly only, e.g., `monday,friday`)

## Timezone

All time handling uses **Asia/Manila (PHT, UTC+8)**. Hardcoded in `scheduler.js`.

## Dependencies

| Package | Purpose |
|---------|---------|
| `discord.js` | Discord API client |
| `@discordjs/voice` | Voice connection and audio receive |
| `better-sqlite3` | SQLite database driver |
| `node-cron` | Cron-based job scheduling |
| `prism-media` | Opus decoding for voice audio |
| `opusscript` | Opus codec bindings |
| `tweetnacl` | Audio encryption for Discord voice |
| `dotenv` | `.env` file loading |

## External Binary

**whisper.cpp** (`whisper-cli`) — called as a child process for speech-to-text. Path configured via `WHISPER_CPP_PATH` and `WHISPER_MODEL_PATH` env vars. Uses 4 threads, auto language detection, 30-second timeout.
