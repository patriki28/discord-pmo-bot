# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2025-03-17

### Added

- **Voice Transcription** — `/transcribe start|stop` joins a voice channel, captures audio per speaker, transcribes via whisper.cpp, and posts a full timestamped transcript on stop. Temp audio files are cleaned up immediately. Consent notice on start. One session per server.
- **Meeting Reminders** — `/schedule set|list|edit|remove` manages recurring meeting reminders with configurable days, time (PHT), channel, role mention, and reminder offset. Permission-gated to creators and Manage Server users.
- **Task Management** — `/task create|list|edit|status|view|delete` provides full task CRUD with title, assignee, priority, due date, description. Paginated listing with filters. Soft-delete preserves cancelled tasks.
- **Task Auto-Detection** — Automatically scans transcriptions for action items using pattern matching. Posts confirmation prompts with Create/Dismiss buttons. Supports assignee selection when unresolved.
- **Task Check-In Reminders** — `/task-reminder set|list|remove` configures daily or weekly task check-in reminders. Check-ins group open tasks by assignee and highlight overdue items.
- **Slash Command Deployment** — `npm run deploy` registers all commands globally via Discord REST API.
- **SQLite Database** — `better-sqlite3` with WAL mode. Tables: `schedules`, `tasks`, `task_reminders`.
- **Project Documentation** — README with setup guide, PRD with detailed feature specs.
