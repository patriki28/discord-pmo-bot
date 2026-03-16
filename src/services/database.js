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
