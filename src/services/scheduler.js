import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { getAllSchedules, getAllTaskReminders, getOpenTasksByGuild } from './database.js';

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

    // Task reminders
    checkTaskReminders(client, now, currentDay, currentMinutes, todayStr);
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

// --- Task Reminders ---

const STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
};

function checkTaskReminders(client, now, currentDay, currentMinutes, todayStr) {
  const reminders = getAllTaskReminders();

  for (const reminder of reminders) {
    // Check frequency / day match
    if (reminder.frequency === 'weekly' && reminder.days) {
      const days = reminder.days.split(',').map(d => DAY_MAP[d.trim().toLowerCase()]);
      if (!days.includes(currentDay)) continue;
    }

    const [hours, mins] = reminder.time.split(':').map(Number);
    const reminderMinutes = hours * 60 + mins;
    if (currentMinutes !== reminderMinutes) continue;

    const dedupKey = `task-${reminder.id}-${todayStr}-${Date.now() - (Date.now() % 60000)}`;
    if (sentReminders.has(dedupKey)) continue;
    sentReminders.add(dedupKey);

    sendTaskCheckIn(client, reminder, now);
  }
}

async function sendTaskCheckIn(client, reminder, now) {
  try {
    const channel = await client.channels.fetch(reminder.channel_id);
    if (!channel) return;

    const tasks = getOpenTasksByGuild(reminder.guild_id);
    if (tasks.length === 0) {
      await channel.send('**Task Check-In** — No open tasks. Great job!');
      return;
    }

    // Group tasks by assignee
    const byAssignee = new Map();
    for (const task of tasks) {
      if (!byAssignee.has(task.assignee_id)) {
        byAssignee.set(task.assignee_id, []);
      }
      byAssignee.get(task.assignee_id).push(task);
    }

    const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const embed = new EmbedBuilder()
      .setTitle('Task Check-In')
      .setColor(0x5865F2)
      .setFooter({ text: `${tasks.length} open task${tasks.length !== 1 ? 's' : ''} — ${todayDate}` });

    const lines = [];
    for (const [assigneeId, assigneeTasks] of byAssignee) {
      lines.push(`**<@${assigneeId}>** (${assigneeTasks.length} task${assigneeTasks.length !== 1 ? 's' : ''}):`);
      for (const t of assigneeTasks) {
        const overdue = t.due_date && t.due_date < todayDate;
        const dueStr = t.due_date ? ` | Due: ${t.due_date}` : '';
        const overdueTag = overdue ? ' **OVERDUE**' : '';
        lines.push(`  \`#${t.id}\` ${t.title} · ${STATUS_LABELS[t.status] ?? t.status}${dueStr}${overdueTag}`);
      }
    }

    embed.setDescription(lines.join('\n'));
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Failed to send task check-in for reminder ${reminder.id}:`, err.message);
  }
}
