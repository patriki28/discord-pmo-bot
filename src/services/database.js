import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', '..', 'data', 'bot.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    days TEXT NOT NULL,
    time TEXT NOT NULL,
    reminder_minutes INTEGER DEFAULT 30,
    mention_role TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    assignee_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS task_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'daily',
    time TEXT NOT NULL,
    days TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export function createSchedule({ guildId, channelId, days, time, reminderMinutes, mentionRole, createdBy }) {
  const stmt = db.prepare(`
    INSERT INTO schedules (guild_id, channel_id, days, time, reminder_minutes, mention_role, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(guildId, channelId, days, time, reminderMinutes ?? 30, mentionRole ?? null, createdBy);
  return result.lastInsertRowid;
}

export function getSchedules(guildId) {
  return db.prepare('SELECT * FROM schedules WHERE guild_id = ?').all(guildId);
}

export function getScheduleById(id) {
  return db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
}

export function getAllSchedules() {
  return db.prepare('SELECT * FROM schedules').all();
}

export function updateSchedule(id, fields) {
  const allowed = ['channel_id', 'days', 'time', 'reminder_minutes', 'mention_role'];
  const sets = [];
  const values = [];

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key) && value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (sets.length === 0) return false;
  values.push(id);
  db.prepare(`UPDATE schedules SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return true;
}

export function deleteSchedule(id) {
  const result = db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
  return result.changes > 0;
}

// --- Task CRUD ---

export function createTask({ guildId, channelId, title, description, assigneeId, createdBy, status, priority, dueDate, source }) {
  const stmt = db.prepare(`
    INSERT INTO tasks (guild_id, channel_id, title, description, assignee_id, created_by, status, priority, due_date, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    guildId, channelId, title, description ?? null, assigneeId, createdBy,
    status ?? 'todo', priority ?? 'medium', dueDate ?? null, source ?? 'manual'
  );
  return result.lastInsertRowid;
}

export function getTaskById(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

export function getTasksByGuild(guildId) {
  return db.prepare('SELECT * FROM tasks WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);
}

export function getOpenTasksByGuild(guildId) {
  return db.prepare(
    "SELECT * FROM tasks WHERE guild_id = ? AND status NOT IN ('done', 'cancelled') ORDER BY created_at DESC"
  ).all(guildId);
}

export function getTasksFiltered({ guildId, assigneeId, status, priority, limit = 10, offset = 0 }) {
  const conditions = ['guild_id = ?'];
  const params = [guildId];

  if (assigneeId) {
    conditions.push('assignee_id = ?');
    params.push(assigneeId);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (priority) {
    conditions.push('priority = ?');
    params.push(priority);
  }

  const where = conditions.join(' AND ');
  const countResult = db.prepare(`SELECT COUNT(*) as total FROM tasks WHERE ${where}`).get(...params);
  const rows = db.prepare(
    `SELECT * FROM tasks WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { tasks: rows, total: countResult.total };
}

export function updateTask(id, fields) {
  const allowed = ['title', 'description', 'assignee_id', 'status', 'priority', 'due_date'];
  const sets = ['updated_at = CURRENT_TIMESTAMP'];
  const values = [];

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key) && value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (sets.length <= 1) return false;
  values.push(id);
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return true;
}

export function softDeleteTask(id) {
  db.prepare("UPDATE tasks SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  return true;
}

// --- Task Reminder CRUD ---

export function createTaskReminder({ guildId, channelId, frequency, time, days, createdBy }) {
  const stmt = db.prepare(`
    INSERT INTO task_reminders (guild_id, channel_id, frequency, time, days, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(guildId, channelId, frequency ?? 'daily', time, days ?? null, createdBy);
  return result.lastInsertRowid;
}

export function getTaskReminders(guildId) {
  return db.prepare('SELECT * FROM task_reminders WHERE guild_id = ?').all(guildId);
}

export function getAllTaskReminders() {
  return db.prepare('SELECT * FROM task_reminders').all();
}

export function deleteTaskReminder(id) {
  const result = db.prepare('DELETE FROM task_reminders WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getTaskReminderById(id) {
  return db.prepare('SELECT * FROM task_reminders WHERE id = ?').get(id);
}
