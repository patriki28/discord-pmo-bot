import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
} from '../services/database.js';

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const data = new SlashCommandBuilder()
  .setName('schedule')
  .setDescription('Meeting schedule management')
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Create a recurring meeting schedule')
      .addStringOption((opt) =>
        opt.setName('days').setDescription('Comma-separated days (e.g., monday,wednesday,friday)').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('time').setDescription('Time in HH:MM 24h format (PHT)').setRequired(true)
      )
      .addChannelOption((opt) =>
        opt.setName('channel').setDescription('Channel for reminders').setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName('reminder').setDescription('Minutes before meeting to send reminder (default: 30)')
      )
      .addRoleOption((opt) =>
        opt.setName('mention').setDescription('Role to mention in reminder')
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Show all scheduled meetings')
  )
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('Edit an existing schedule')
      .addIntegerOption((opt) =>
        opt.setName('id').setDescription('Schedule ID').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('days').setDescription('New days (comma-separated)')
      )
      .addStringOption((opt) =>
        opt.setName('time').setDescription('New time in HH:MM 24h format (PHT)')
      )
      .addChannelOption((opt) =>
        opt.setName('channel').setDescription('New reminder channel')
      )
      .addIntegerOption((opt) =>
        opt.setName('reminder').setDescription('New reminder minutes')
      )
      .addRoleOption((opt) =>
        opt.setName('mention').setDescription('New role to mention')
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Delete a schedule')
      .addIntegerOption((opt) =>
        opt.setName('id').setDescription('Schedule ID to delete').setRequired(true)
      )
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'set':
      return handleSet(interaction);
    case 'list':
      return handleList(interaction);
    case 'edit':
      return handleEdit(interaction);
    case 'remove':
      return handleRemove(interaction);
  }
}

function parseDays(input) {
  const days = input.toLowerCase().split(',').map((d) => d.trim());
  const invalid = days.filter((d) => !VALID_DAYS.includes(d));
  return { days, invalid };
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
  const daysInput = interaction.options.getString('days');
  const timeInput = interaction.options.getString('time');
  const channel = interaction.options.getChannel('channel');
  const reminder = interaction.options.getInteger('reminder') ?? 30;
  const mention = interaction.options.getRole('mention');

  const { days, invalid } = parseDays(daysInput);
  if (invalid.length > 0) {
    return interaction.reply({ content: `Invalid day(s): ${invalid.join(', ')}`, ephemeral: true });
  }

  const time = parseTime(timeInput);
  if (!time) {
    return interaction.reply({ content: 'Invalid time format. Use HH:MM (24h).', ephemeral: true });
  }

  if (reminder < 1 || reminder > 1440) {
    return interaction.reply({ content: 'Reminder must be between 1 and 1440 minutes.', ephemeral: true });
  }

  const id = createSchedule({
    guildId: interaction.guild.id,
    channelId: channel.id,
    days: days.join(','),
    time,
    reminderMinutes: reminder,
    mentionRole: mention?.id,
    createdBy: interaction.user.id,
  });

  await interaction.reply(
    `Schedule **#${id}** created.\n` +
    `**Days:** ${days.join(', ')}\n` +
    `**Time:** ${time} PHT\n` +
    `**Reminder:** ${reminder} min before\n` +
    `**Channel:** <#${channel.id}>` +
    (mention ? `\n**Mention:** <@&${mention.id}>` : '')
  );
}

async function handleList(interaction) {
  const schedules = getSchedules(interaction.guild.id);
  if (schedules.length === 0) {
    return interaction.reply({ content: 'No schedules found.', ephemeral: true });
  }

  const lines = schedules.map((s) =>
    `**#${s.id}** — ${s.days} at ${s.time} PHT → <#${s.channel_id}> (${s.reminder_minutes}min reminder)` +
    (s.mention_role ? ` | <@&${s.mention_role}>` : '')
  );

  await interaction.reply(lines.join('\n'));
}

async function handleEdit(interaction) {
  const id = interaction.options.getInteger('id');
  const schedule = getScheduleById(id);

  if (!schedule) {
    return interaction.reply({ content: `Schedule #${id} not found.`, ephemeral: true });
  }

  // Permission check: creator or Manage Server
  const isCreator = schedule.created_by === interaction.user.id;
  const hasManageServer = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
  if (!isCreator && !hasManageServer) {
    return interaction.reply({
      content: 'Only the schedule creator or users with Manage Server permission can edit this.',
      ephemeral: true,
    });
  }

  const fields = {};

  const daysInput = interaction.options.getString('days');
  if (daysInput) {
    const { days, invalid } = parseDays(daysInput);
    if (invalid.length > 0) {
      return interaction.reply({ content: `Invalid day(s): ${invalid.join(', ')}`, ephemeral: true });
    }
    fields.days = days.join(',');
  }

  const timeInput = interaction.options.getString('time');
  if (timeInput) {
    const time = parseTime(timeInput);
    if (!time) {
      return interaction.reply({ content: 'Invalid time format. Use HH:MM (24h).', ephemeral: true });
    }
    fields.time = time;
  }

  const channel = interaction.options.getChannel('channel');
  if (channel) fields.channel_id = channel.id;

  const reminder = interaction.options.getInteger('reminder');
  if (reminder !== null) {
    if (reminder < 1 || reminder > 1440) {
      return interaction.reply({ content: 'Reminder must be between 1 and 1440 minutes.', ephemeral: true });
    }
    fields.reminder_minutes = reminder;
  }

  const mention = interaction.options.getRole('mention');
  if (mention) fields.mention_role = mention.id;

  if (Object.keys(fields).length === 0) {
    return interaction.reply({ content: 'No fields to update.', ephemeral: true });
  }

  updateSchedule(id, fields);
  const updated = getScheduleById(id);

  await interaction.reply(
    `Schedule **#${id}** updated.\n` +
    `**Days:** ${updated.days}\n` +
    `**Time:** ${updated.time} PHT\n` +
    `**Reminder:** ${updated.reminder_minutes} min before\n` +
    `**Channel:** <#${updated.channel_id}>` +
    (updated.mention_role ? `\n**Mention:** <@&${updated.mention_role}>` : '')
  );
}

async function handleRemove(interaction) {
  const id = interaction.options.getInteger('id');
  const schedule = getScheduleById(id);

  if (!schedule) {
    return interaction.reply({ content: `Schedule #${id} not found.`, ephemeral: true });
  }

  // Permission check: creator or Manage Server
  const isCreator = schedule.created_by === interaction.user.id;
  const hasManageServer = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
  if (!isCreator && !hasManageServer) {
    return interaction.reply({
      content: 'Only the schedule creator or users with Manage Server permission can remove this.',
      ephemeral: true,
    });
  }

  deleteSchedule(id);
  await interaction.reply(`Schedule **#${id}** deleted.`);
}
