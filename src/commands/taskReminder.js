import { SlashCommandBuilder } from 'discord.js';
import {
  createTaskReminder,
  getTaskReminders,
  deleteTaskReminder,
  getTaskReminderById,
} from '../services/database.js';

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const data = new SlashCommandBuilder()
  .setName('task-reminder')
  .setDescription('Task check-in reminder management')
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set a recurring task check-in reminder')
      .addStringOption((opt) =>
        opt.setName('frequency').setDescription('Reminder frequency').setRequired(true)
          .addChoices(
            { name: 'Daily', value: 'daily' },
            { name: 'Weekly', value: 'weekly' },
          )
      )
      .addStringOption((opt) =>
        opt.setName('time').setDescription('Time in HH:MM 24h format (PHT)').setRequired(true)
      )
      .addChannelOption((opt) =>
        opt.setName('channel').setDescription('Channel to post check-in').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('days').setDescription('Comma-separated days for weekly (e.g., monday,friday)')
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all task check-in reminders')
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Remove a task check-in reminder')
      .addIntegerOption((opt) =>
        opt.setName('id').setDescription('Reminder ID').setRequired(true)
      )
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'set': return handleSet(interaction);
    case 'list': return handleList(interaction);
    case 'remove': return handleRemove(interaction);
  }
}

function parseTime(input) {
  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function handleSet(interaction) {
  const frequency = interaction.options.getString('frequency');
  const timeInput = interaction.options.getString('time');
  const channel = interaction.options.getChannel('channel');
  const daysInput = interaction.options.getString('days');

  const time = parseTime(timeInput);
  if (!time) {
    return interaction.reply({ content: 'Invalid time format. Use HH:MM (24h).', ephemeral: true });
  }

  let days = null;
  if (frequency === 'weekly') {
    if (!daysInput) {
      return interaction.reply({ content: 'Weekly reminders require the `days` option.', ephemeral: true });
    }
    const parsed = daysInput.toLowerCase().split(',').map(d => d.trim());
    const invalid = parsed.filter(d => !VALID_DAYS.includes(d));
    if (invalid.length > 0) {
      return interaction.reply({ content: `Invalid day(s): ${invalid.join(', ')}`, ephemeral: true });
    }
    days = parsed.join(',');
  }

  const id = createTaskReminder({
    guildId: interaction.guild.id,
    channelId: channel.id,
    frequency,
    time,
    days,
    createdBy: interaction.user.id,
  });

  await interaction.reply(
    `Task reminder **#${id}** created.\n` +
    `**Frequency:** ${frequency}\n` +
    `**Time:** ${time} PHT\n` +
    (days ? `**Days:** ${days}\n` : '') +
    `**Channel:** <#${channel.id}>`
  );
}

async function handleList(interaction) {
  const reminders = getTaskReminders(interaction.guild.id);
  if (reminders.length === 0) {
    return interaction.reply({ content: 'No task reminders configured.', ephemeral: true });
  }

  const lines = reminders.map(r =>
    `**#${r.id}** — ${r.frequency} at ${r.time} PHT → <#${r.channel_id}>` +
    (r.days ? ` (${r.days})` : '')
  );

  await interaction.reply(lines.join('\n'));
}

async function handleRemove(interaction) {
  const id = interaction.options.getInteger('id');
  const reminder = getTaskReminderById(id);

  if (!reminder || reminder.guild_id !== interaction.guild.id) {
    return interaction.reply({ content: `Reminder #${id} not found.`, ephemeral: true });
  }

  deleteTaskReminder(id);
  await interaction.reply(`Task reminder **#${id}** removed.`);
}
