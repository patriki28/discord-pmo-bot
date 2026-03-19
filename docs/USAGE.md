# Discord PMO Bot Usage Guide

This guide explains day-to-day operation of the bot after setup.

## 1) Start the bot

From project root:

```bash
npm start
```

Expected startup log:

- `Ready — logged in as ...`

If startup fails, check `.env` values and `docs/DEPLOYMENT.md` troubleshooting.

## 2) Register or update slash commands

Run this when commands are added/changed:

```bash
npm run deploy
```

If `GUILD_ID` is set in `.env`, command updates are near-instant in that guild.

## 3) Use transcription in Discord

### Start transcription

1. Join a voice channel.
2. Run `/transcribe start` in a text channel.

What happens:

- Bot joins your voice channel.
- Consent notice is posted.
- Speech lines are transcribed and posted in text.
- Pipeline uses profile settings from `.env` (`TRANSCRIBE_PROFILE`, language, timeout, retries, segmentation thresholds).
- Adjacent chunks keep short context carryover to reduce phrase splits.

### Stop transcription

Run:

`/transcribe stop`

What happens:

- Bot flushes remaining audio.
- Posts full transcript in text (chunked if needed).
- Creates a meeting-minutes markdown file in `transcripts/` (or `TRANSCRIPTS_DIR`).
- Attempts to attach the transcript file in the channel.
- Leaves voice channel.

## 4) Transcript file output

Default location:

- `./transcripts`

Filename format:

- `transcript-<guildId>-<timestamp>.md`

Config override:

- Set `TRANSCRIPTS_DIR` in `.env`.

## 5) Common commands

- `/transcribe start`
- `/transcribe stop`
- `/schedule set`
- `/schedule list`
- `/schedule edit`
- `/schedule remove`
- `/task create`
- `/task list`
- `/task edit`
- `/task status`
- `/task view`
- `/task delete`
- `/task-reminder set`
- `/task-reminder list`
- `/task-reminder remove`

Full command details: `docs/COMMANDS.md`.

## 6) Run tests

```bash
npm test
```

This runs unit tests for:

- transcription command handling
- voice transcript formatting
- transcription service behavior
- audio utilities
- config validation

Quality gate suite:

```bash
npm run test:quality
```

This runs the transcription quality fixture checks and task detection quality checks.

## 7) Troubleshooting quick checks

### Whisper executable/model path issues

Check:

```powershell
Test-Path "C:/.../whisper-cli.exe"
Test-Path "C:/.../ggml-*.bin"
```

Both should be `True`.

### Slash commands not appearing

- Re-run `npm run deploy`.
- Confirm bot has `applications.commands` scope in Discord invite.
- For faster updates, set `GUILD_ID`.
