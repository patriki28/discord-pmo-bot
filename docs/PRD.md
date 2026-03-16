# Product Requirements Document — Discord PMO Bot

**Version:** 1.0
**Date:** 2026-03-17
**Status:** In Development

---

## 1. Overview

Discord PMO Bot is a self-hosted Discord bot that automates core project management tasks:

1. **Voice Transcription** — automatically transcribes everything said in Discord voice channels using local speech-to-text (whisper.cpp)
2. **Meeting Reminders** — sends configurable reminders before scheduled recurring meetings
3. **Task Management** — tracks action items with auto-detection from transcriptions, full CRUD via slash commands, and recurring check-in reminders

The bot is designed for small-to-medium teams running standups, syncs, or recurring meetings on Discord who need transcripts without paying for third-party services.

## 2. Problem Statement

- Teams hold meetings in Discord voice channels but have no record of what was discussed. Notes are taken manually (if at all) and are often incomplete.
- Recurring meetings are missed because there's no centralized reminder system tied to the Discord server itself.
- Existing transcription bots are cloud-based, paid, and raise data privacy concerns.

## 3. Target Users

- Small teams (5–30 people) using Discord as their primary communication platform
- Project managers or team leads who need meeting records
- Philippines-based teams (hardcoded PHT timezone)

## 4. Goals

| Goal | Success Metric |
|------|---------------|
| Reduce missed meetings | Reminder delivery rate > 99% for scheduled meetings |
| Provide usable transcripts | Transcriptions posted within seconds of speech ending |
| Track action items | Tasks created within seconds of detection or manual input |
| Zero recurring cost | Fully self-hosted, no paid APIs |
| Minimal setup friction | Bot operational within 15 minutes of cloning the repo |

## 5. Non-Goals

- Real-time translation between languages
- Speaker diarization with voice fingerprinting
- Web dashboard or UI outside of Discord
- Multi-timezone support (PHT only for v1)
- Audio recording or persistent storage of voice data

## 6. Features

### 6.1 Voice Transcription

**Command:** `/transcribe start` | `/transcribe stop`

**Flow:**
1. User joins a voice channel and runs `/transcribe start`
2. Bot joins the voice channel (muted, not deafened) and posts a consent notice
3. Bot subscribes to each speaking user's audio stream
4. Audio is decoded from Opus to PCM, buffered per user
5. On 1 second of silence, the buffer is flushed, converted to WAV, and sent to whisper.cpp
6. Transcription result is posted to the text channel: `**Username:** transcribed text`
7. When `/transcribe stop` is run, the bot posts a full timestamped transcript and leaves the channel

**Constraints:**
- One active transcription session per server
- No audio is persisted to disk beyond temporary WAV files (deleted immediately after transcription)
- Minimum audio length of ~100ms to avoid transcribing noise

### 6.2 Meeting Reminders

**Commands:**
- `/schedule set <days> <time> <channel> [reminder] [mention]` — create a recurring schedule
- `/schedule list` — view all schedules for the server
- `/schedule edit <id> [days] [time] [channel] [reminder] [mention]` — update specific fields
- `/schedule remove <id>` — delete a schedule

**Flow:**
1. User creates a schedule specifying days of the week, time (24h PHT), target channel, and optional reminder offset and role mention
2. A cron job runs every minute, comparing current time (in Asia/Manila) against all schedules
3. When `current_time == meeting_time - reminder_minutes`, the bot sends a reminder to the configured channel
4. Deduplication prevents double-sending if the bot restarts within the same minute

**Constraints:**
- All times are in Asia/Manila (PHT), hardcoded
- Reminder offset is configurable per schedule (default: 30 minutes, range: 1–1440)
- Only the schedule creator or users with Manage Server permission can edit/remove schedules

### 6.3 Task Management

**Slash Commands:**
- `/task create <title> <assignee> [priority] [due_date] [description]` — create a task manually
- `/task list [assignee] [status] [priority]` — list tasks with optional filters, paginated (10 per page)
- `/task edit <id> [title] [status] [priority] [assignee] [due_date]` — update task fields
- `/task status <id> <new_status>` — quick status change
- `/task view <id>` — detailed task embed
- `/task delete <id>` — soft delete (sets status to Cancelled)

**Task Statuses (5-state):** To Do → In Progress → In Review → Done → Cancelled

**Priority Levels (4):** Low, Medium, High, Critical

**Auto-Detection from Transcription:**
1. During voice transcription, each utterance is scanned for action item patterns:
   - `action item: ...`, `task: ...`, `TODO: ...`
   - `@user needs to/should/will/must ...`
   - `assign to @user ...`
   - `@user, please ...`
2. Detected candidates are posted as confirmation embeds with **Create Task** / **Dismiss** buttons
3. If assignee is detected from name, the task is created immediately on confirm
4. If assignee is unknown, a user-select menu is shown to pick an assignee
5. Pending confirmations expire after 5 minutes

**Recurring Check-In Reminders:**
- `/task-reminder set <frequency> <time> <channel> [days]` — set daily or weekly check-in
- `/task-reminder list` — view configured reminders
- `/task-reminder remove <id>` — remove a reminder
- At the scheduled time, the bot posts an embed listing all open tasks grouped by assignee
- Overdue tasks (past due date) are highlighted

**Constraints:**
- Auto-detected tasks default to Medium priority
- `/task delete` is a soft delete (status set to Cancelled)
- Only the task creator or users with Manage Server permission can delete tasks

## 7. Technical Architecture

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js (ES Modules) |
| Bot Framework | discord.js v14 |
| Voice Receive | @discordjs/voice + prism-media + opusscript |
| Speech-to-Text | whisper.cpp (medium model, local binary) |
| Database | SQLite via better-sqlite3 |
| Scheduling | node-cron |
| Config | dotenv |

### Data Flow — Transcription

```
Voice Channel → Opus packets → prism-media Decoder → PCM buffer (per user)
  → [on silence] → WAV conversion (in-memory) → temp file
  → whisper.cpp CLI → parsed text → Discord text channel message
```

### Data Flow — Reminders

```
node-cron (every minute) → load all schedules from SQLite
  → filter by current day + check if reminder time matches
  → dedup check (in-memory Set) → send reminder message to channel
```

## 8. Database Schema

```sql
CREATE TABLE schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  days TEXT NOT NULL,            -- comma-separated: "monday,wednesday,friday"
  time TEXT NOT NULL,            -- "HH:MM" in 24h PHT
  reminder_minutes INTEGER DEFAULT 30,
  mention_role TEXT,             -- Discord role ID (nullable)
  created_by TEXT NOT NULL,      -- Discord user ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id TEXT NOT NULL,     -- Discord user ID
  created_by TEXT NOT NULL,      -- Discord user ID
  status TEXT NOT NULL DEFAULT 'todo',      -- todo|in_progress|in_review|done|cancelled
  priority TEXT NOT NULL DEFAULT 'medium',  -- low|medium|high|critical
  due_date TEXT,                 -- YYYY-MM-DD (nullable)
  source TEXT NOT NULL DEFAULT 'manual',    -- manual|transcription
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',  -- daily|weekly
  time TEXT NOT NULL,            -- "HH:MM" in 24h PHT
  days TEXT,                     -- comma-separated days for weekly (nullable)
  created_by TEXT NOT NULL,      -- Discord user ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 9. Permissions

| Action | Who Can Do It |
|--------|--------------|
| Start/stop transcription | Any server member in a voice channel |
| Create a schedule | Any server member |
| Edit/remove a schedule | Schedule creator OR users with Manage Server permission |
| Create/edit/view/list tasks | Any server member |
| Delete a task | Task creator OR users with Manage Server permission |
| Manage task reminders | Any server member |
| Bot channel permissions required | Connect, Speak, Send Messages, Embed Links, Mention Everyone |

## 10. Privacy & Data Handling

- A consent notice is posted when transcription starts; staying in the channel implies consent
- No audio is stored permanently — temporary WAV files are deleted immediately after whisper.cpp processes them
- PCM buffers exist only in memory during the active session
- Transcription text is posted to Discord only (not stored in the database)
- The bot runs entirely on the host machine — no data leaves the local network except to Discord's API

## 11. Prerequisites

1. **Discord Bot Application** — created via Discord Developer Portal with appropriate intents and permissions
2. **whisper.cpp** — compiled locally with the medium model downloaded (~1.5 GB)
3. **Node.js** — v18+

## 12. Limitations (v1)

- Single timezone (Asia/Manila) — no per-user or per-schedule timezone
- One transcription session per server at a time
- No speaker identification beyond Discord username
- Transcription accuracy depends on whisper.cpp medium model and audio quality
- No web interface — all interaction via Discord slash commands
- Schedule reminders require the bot to be running continuously (no catch-up for missed reminders)
- Task auto-detection relies on keyword patterns; not all action items will be caught
- No maximum task limit per guild

## 13. Future Considerations

These are explicitly **not planned** but noted for potential future versions:

- Multi-timezone support with per-schedule timezone selection
- Transcript export (markdown file, PDF)
- Concurrent transcription sessions across multiple channels
- Whisper model selection per session (tiny/small/medium/large)
- Meeting agenda templates tied to schedules
- Automatic summary generation from transcripts
