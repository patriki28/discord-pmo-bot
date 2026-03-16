import cron from 'node-cron';
import { getAllSchedules } from './database.js';

const DAY_MAP = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

// Dedup: track which reminders have already been sent
const sentReminders = new Set();

// Clean old entries daily
function pruneOldEntries() {
  const now = Date.now();
  for (const key of sentReminders) {
    const ts = parseInt(key.split('-').pop(), 10);
    if (now - ts > 24 * 60 * 60 * 1000) {
      sentReminders.delete(key);
    }
  }
}

export function startScheduler(client) {
  // Check every minute
  cron.schedule('* * * * *', () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    const schedules = getAllSchedules();

    for (const schedule of schedules) {
      const days = schedule.days.split(',').map(d => DAY_MAP[d.trim().toLowerCase()]);
      if (!days.includes(currentDay)) continue;

      const [hours, mins] = schedule.time.split(':').map(Number);
      const meetingMinutes = hours * 60 + mins;
      const reminderMinutes = schedule.reminder_minutes ?? 30;

      // Check if it's time to send the reminder
      const reminderTime = meetingMinutes - reminderMinutes;
      if (currentMinutes !== reminderTime) continue;

      const dedupKey = `${schedule.id}-${todayStr}-${Date.now() - (Date.now() % 60000)}`;
      if (sentReminders.has(dedupKey)) continue;
      sentReminders.add(dedupKey);

      sendReminder(client, schedule);
    }
  });

  // Prune old dedup entries every hour
  cron.schedule('0 * * * *', pruneOldEntries);
}

async function sendReminder(client, schedule) {
  try {
    const channel = await client.channels.fetch(schedule.channel_id);
    if (!channel) return;

    const mention = schedule.mention_role ? `<@&${schedule.mention_role}> ` : '';
    const reminderMin = schedule.reminder_minutes ?? 30;

    await channel.send(
      `${mention}**Meeting Reminder** — starting in ${reminderMin} minute${reminderMin !== 1 ? 's' : ''} (at ${schedule.time} PHT)`
    );
  } catch (err) {
    console.error(`Failed to send reminder for schedule ${schedule.id}:`, err.message);
  }
}
