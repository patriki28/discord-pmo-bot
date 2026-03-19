# Epics & User Stories

Structured backlog for Discord PMO Bot. Done epics (1–5) cover v1.0 delivered features. Planned epics (6–12) define the roadmap with acceptance criteria.

---

## EPIC 1: Voice Transcription — Done

| ID | Story | Priority |
|----|-------|----------|
| VT-1 | As a team member, I want to start a transcription session in my voice channel so that everything said is automatically captured. | P0 |
| VT-2 | As a team member, I want each person's speech posted with their name so I can follow along in real time. | P0 |
| VT-3 | As a team member, I want a full timestamped transcript on session stop so I have a complete meeting record. | P0 |
| VT-4 | As a team member, I want temp audio files cleaned up immediately so no voice data persists on disk. | P0 |
| VT-5 | As a team member, I want a consent notice when transcription starts so participants are informed. | P0 |
| VT-6 | As a server admin, I want only one transcription session per server so resources aren't overloaded. | P1 |

---

## EPIC 2: Meeting Reminders — Done

| ID | Story | Priority |
|----|-------|----------|
| MR-1 | As a team lead, I want to create a recurring schedule (days, time, channel, role mention) so the right people get reminded. | P0 |
| MR-2 | As a team lead, I want to list all schedules for my server. | P0 |
| MR-3 | As a team lead, I want to edit schedule fields without recreating it. | P1 |
| MR-4 | As a team lead, I want to remove a schedule so outdated meetings stop sending reminders. | P0 |
| MR-5 | As a team member, I want reminders at a configurable offset before meetings. | P0 |
| MR-6 | As a server admin, I want only creators or Manage Server users to edit/remove schedules. | P1 |

---

## EPIC 3: Task Management — Done

| ID | Story | Priority |
|----|-------|----------|
| TM-1 | As a team member, I want to create tasks with title, assignee, priority, due date, description. | P0 |
| TM-2 | As a team member, I want to list tasks with filters (assignee, status, priority) and pagination. | P0 |
| TM-3 | As a team member, I want to edit task fields. | P0 |
| TM-4 | As a team member, I want a quick status change command. | P1 |
| TM-5 | As a team member, I want to view detailed task info in a rich embed. | P1 |
| TM-6 | As a task creator/admin, I want soft-delete so cancelled tasks are preserved. | P0 |

---

## EPIC 4: Task Auto-Detection — Done

| ID | Story | Priority |
|----|-------|----------|
| TD-1 | As a team member, I want action items from meetings automatically detected via patterns. | P0 |
| TD-2 | As a team member, I want a confirmation prompt before detected tasks are created. | P0 |
| TD-3 | As a team member, I want to select an assignee when auto-detection can't resolve one. | P1 |
| TD-4 | As a team member, I want dismissed candidates visually marked. | P1 |

---

## EPIC 5: Task Check-In Reminders — Done

| ID | Story | Priority |
|----|-------|----------|
| TR-1 | As a team lead, I want daily/weekly task check-in reminders. | P0 |
| TR-2 | As a team lead, I want check-ins grouped by assignee. | P0 |
| TR-3 | As a team member, I want overdue tasks highlighted in check-ins. | P1 |
| TR-4 | As a team lead, I want to list and remove configured reminders. | P0 |

---

## EPIC 6: Reliability & Observability — Planned

**Why:** Bot currently has no structured logging, loses in-memory state on restart, and doesn't handle missed reminders.

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| RO-1 | As an operator, I want structured logging with timestamps and levels so I can debug from log files. | Replace `console.log`/`console.error` with pino or winston; JSON output with timestamp, level, guildId, userId. | P1 |
| RO-2 | As an operator, I want pagination state to survive restarts. | Re-query on button press using filter params embedded in `customId` (no DB changes needed). | P1 |
| RO-3 | As an operator, I want missed reminders caught up after restart. | On startup, check if any reminder should have fired in the last 60 min; send "late reminder" if so. Store `last_sent` timestamp per schedule in DB. | P1 |
| RO-4 | As an operator, I want a `/status` command showing uptime, active sessions, schedule/task counts. | Ephemeral reply with bot stats. | P2 |
| RO-5 | As an operator, I want a max task limit per guild to prevent unbounded DB growth. | Configurable `MAX_TASKS_PER_GUILD` (default 1000); reject new tasks with friendly message. | P2 |
| RO-6 | As an operator, I want graceful shutdown (flush transcription sessions, close DB). | SIGINT/SIGTERM handler stops voice sessions, posts transcripts, closes DB. | P1 |

---

## ~~EPIC 7: Multi-Timezone Support~~ — DROPPED

**Decision:** Keep PHT (Asia/Manila) only. No multi-timezone support needed — target audience is Philippines-based teams.

---

## EPIC 8: Transcript Export & Storage — Planned

**Why:** Transcripts are currently ephemeral — only exist as Discord messages.

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| TE-1 | As a team member, I want to download the transcript as a `.md` file. | "Download Transcript" button on stop; Discord file attachment. | P1 |
| TE-2 | As a team lead, I want transcripts saved to the database. | New `transcripts` table referencing Discord message IDs; stored on session stop. | P2 |
| TE-3 | As a team member, I want to retrieve past transcripts by date. | `/transcript list` + `/transcript view <id>`. | P2 |

---

## EPIC 9: Transcription Quality & Flexibility — In Progress

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| TQ-1 | As an operator, I want profile-based transcription tuning for local runtime tradeoffs. | `TRANSCRIBE_PROFILE=accuracy|balanced|fast` controls defaults. | P0 |
| TQ-2 | As an operator, I want configurable language and thread/timeout controls. | `TRANSCRIBE_LANGUAGE`, `TRANSCRIBE_THREADS`, `TRANSCRIBE_TIMEOUT_MS` are supported. | P0 |
| TQ-3 | As an operator, I want segmentation and overlap controls to reduce phrase splitting. | `TRANSCRIBE_SILENCE_MS`, `TRANSCRIBE_MIN_AUDIO_MS`, `TRANSCRIBE_OVERLAP_MS` are supported. | P0 |
| TQ-4 | As an operator, I want retry/queue controls and telemetry to reduce silent failures. | Retry/queue env vars + structured telemetry logs exist. | P0 |
| TQ-5 | As QA, I want fixture-based transcription quality checks in CI. | Test matrix exists and gate policy is documented. | P1 |

---

## EPIC 10: Meeting Agenda Templates — Planned

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| MA-1 | As a team lead, I want to attach an agenda to a schedule. | `/schedule agenda <id> <text>`; new `agenda` column on schedules. | P2 |
| MA-2 | As a team member, I want the agenda in the reminder message. | Agenda appended as bulleted list in reminder embed. | P2 |

---

## EPIC 11: Task Enhancements — Planned

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| TX-1 | As a team member, I want to add comments to tasks. | `/task comment <id> <text>`; `task_comments` table; shown in `/task view`. | P2 |
| TX-2 | As a team lead, I want task status change history. | `task_history` table; logged on every update; timeline in `/task view`. | P2 |
| TX-3 | As a team member, I want more flexible auto-detection patterns ("we need to...", "let's...", "don't forget to..."). | Configurable patterns via JSON file or DB. | P2 |
| TX-4 | As a team member, I want `/task my` as a shortcut for my assigned tasks. | Alias for `/task list assignee:@me`. | P1 |
| TX-5 | As a team member, I want to be notified when a task is assigned to me. | Channel ping on create/reassign; opt-out option. | P2 |

---

## EPIC 12: Automatic Meeting Summary — Planned

| ID | Story | Acceptance Criteria | Priority |
|----|-------|---------------------|----------|
| MS-1 | As a team lead, I want an auto-summary when transcription ends. | Summarization via local LLM (llama.cpp) or extractive method; posted before full transcript. | P2 |
| MS-2 | As a team member, I want the summary to list detected action items separately. | "Detected Action Items" section in summary embed. | P2 |
