# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] - 2026-03-19

### Added

- **Meeting minutes transcript export** — `/transcribe stop` now writes a markdown transcript file to `transcripts/` (or `TRANSCRIPTS_DIR`) and optionally attaches it to Discord when file size allows.
- **Voice session hardening** — Added speaking subscription guard to avoid duplicate user stream subscriptions in voice receive flows.
- **Unit test suite (Vitest)** — Added tests for audio utilities, transcription service, transcribe command handlers, voice transcript formatting, and config validation.
- **Developer Portal setup coverage** — Updated docs for required Discord scopes, intents, and permissions (including `Attach Files`).
- **Optional configuration** — Added support for `GUILD_ID` (faster guild command registration) and `TRANSCRIPTS_DIR`.
- **Transcription quality pipeline controls** — Added configurable `TRANSCRIBE_*` profile and tuning environment variables.
- **Quality planning docs** — Added `docs/TRANSCRIPTION-ACCURACY-ENHANCEMENT-PLAN.md` and `docs/TRANSCRIPTION-QUALITY-TEST-MATRIX.md`.
- **Quality fixture tests** — Added `npm run test:quality` with baseline fixture WER/task-detection gate tests.

### Changed

- **Config validation behavior** — `deploy`/startup no longer hard-fails due to Whisper path checks unless transcription is invoked. Whisper binary/model checks are now performed when transcription runs.
- **Transcription error messaging** — Improved ENOENT and missing path diagnostics with actionable remediation hints.
- **Documentation updates** — README and PRD now reflect transcript file output and updated permissions.
- **Transcription internals** — Added queue/retry controls, context carryover prompts, and preprocessing hooks (mono downmix + normalization).

### Fixed

- Fixed `/transcribe start` runtime failures caused by placeholder Whisper paths by improving validation flow and documentation.
- Fixed `/transcribe stop` behavior to produce persistent meeting minutes output, reducing risk of transcript loss after message scroll/history cleanup.

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
