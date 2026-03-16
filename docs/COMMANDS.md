# Command Reference

All commands are Discord slash commands. Register them with `npm run deploy`.

---

## `/transcribe` — Voice Transcription

### `/transcribe start`

Join your voice channel and begin transcribing.

- **Requires:** You must be in a voice channel.
- **Limit:** One active session per server.
- **Behavior:** Posts a consent notice, joins the channel (muted), and transcribes each speaker's audio in real time via whisper.cpp. Detected action items trigger a confirmation prompt.

### `/transcribe stop`

Stop the active transcription session.

- **Behavior:** Flushes remaining audio, posts the full timestamped transcript, and disconnects from the voice channel.

---

## `/schedule` — Meeting Reminders

### `/schedule set`

Create a new recurring meeting reminder.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `days` | String | Yes | Comma-separated days (e.g., `monday,wednesday,friday`) |
| `time` | String | Yes | Meeting time in HH:MM 24h format (PHT) |
| `channel` | Channel | Yes | Channel to post the reminder in |
| `reminder` | Integer | No | Minutes before meeting to send reminder (1–1440, default: 30) |
| `mention` | Role | No | Role to mention in the reminder |

**Example:** `/schedule set days:monday,thursday time:09:00 channel:#standup mention:@Team reminder:15`

### `/schedule list`

List all schedules for this server. Shows ID, days, time, channel, reminder offset, and mention role.

### `/schedule edit`

Edit an existing schedule. Only the schedule creator or users with Manage Server permission can edit.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | Integer | Yes | Schedule ID |
| `days` | String | No | New days |
| `time` | String | No | New time |
| `channel` | Channel | No | New channel |
| `reminder` | Integer | No | New reminder offset |
| `mention` | Role | No | New mention role |

### `/schedule remove`

Delete a schedule. Only the schedule creator or users with Manage Server permission can remove.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | Integer | Yes | Schedule ID |

---

## `/task` — Task Management

### `/task create`

Create a new task.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `title` | String | Yes | Task title |
| `assignee` | User | Yes | Assigned team member |
| `priority` | String | No | `low`, `medium` (default), `high`, `critical` |
| `due_date` | String | No | Due date in YYYY-MM-DD format |
| `description` | String | No | Task description |

**Example:** `/task create title:Update API docs assignee:@Alice priority:high due_date:2025-04-01`

### `/task list`

List tasks with optional filters. Results are paginated (10 per page) with Previous/Next buttons.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `assignee` | User | No | Filter by assignee |
| `status` | String | No | `todo`, `in_progress`, `in_review`, `done`, `cancelled` |
| `priority` | String | No | `low`, `medium`, `high`, `critical` |

### `/task edit`

Edit task fields.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | Integer | Yes | Task ID |
| `title` | String | No | New title |
| `status` | String | No | New status |
| `priority` | String | No | New priority |
| `assignee` | User | No | New assignee |
| `due_date` | String | No | New due date (YYYY-MM-DD) |

### `/task status`

Quick status change.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | Integer | Yes | Task ID |
| `new_status` | String | Yes | `todo`, `in_progress`, `in_review`, `done`, `cancelled` |

**Example:** `/task status id:42 new_status:done`

### `/task view`

View detailed task info as a rich embed. Shows all fields including creator, assignee, creation and update timestamps.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | Integer | Yes | Task ID |

### `/task delete`

Soft-delete a task (sets status to `cancelled`). Only the task creator or users with Manage Server permission can delete.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | Integer | Yes | Task ID |

---

## `/task-reminder` — Task Check-In Reminders

### `/task-reminder set`

Create a recurring task check-in reminder.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `frequency` | String | Yes | `daily` or `weekly` |
| `time` | String | Yes | Time in HH:MM 24h format (PHT) |
| `channel` | Channel | Yes | Channel to post the check-in in |
| `days` | String | No | Comma-separated days (required for weekly, e.g., `monday,friday`) |

**Example:** `/task-reminder set frequency:daily time:09:00 channel:#tasks`

### `/task-reminder list`

List all configured task reminders for this server.

### `/task-reminder remove`

Delete a task reminder.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | Integer | Yes | Reminder ID |

---

## Permissions Summary

| Action | Who Can Do It |
|--------|---------------|
| Start/stop transcription | Any member in a voice channel |
| Create schedule | Any member |
| Edit/remove schedule | Schedule creator or Manage Server |
| Create/edit/view/list tasks | Any member |
| Delete task | Task creator or Manage Server |
| Set/remove task reminders | Any member |

## Auto-Detected Tasks

During transcription, the bot scans for action items using these patterns:

- `action item: <text>` / `task: <text>` / `todo: <text>`
- `@user needs to/should/will/must <text>`
- `assign to @user <text>`
- `@user, please <text>`

Detected items appear as embeds with **Create Task** and **Dismiss** buttons. If the assignee can't be resolved, a user select menu appears.
