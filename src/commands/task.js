import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import {
  createTask,
  getTaskById,
  getTasksFiltered,
  updateTask,
  softDeleteTask,
} from '../services/database.js';

const STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const PRIORITY_COLORS = {
  low: 0x95A5A6,
  medium: 0x3498DB,
  high: 0xF39C12,
  critical: 0xE74C3C,
};

export const data = new SlashCommandBuilder()
  .setName('task')
  .setDescription('Task management')
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('Create a new task')
      .addStringOption((opt) => opt.setName('title').setDescription('Task title').setRequired(true))
      .addUserOption((opt) => opt.setName('assignee').setDescription('Person assigned to this task').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('priority').setDescription('Priority level')
          .addChoices(
            { name: 'Low', value: 'low' },
            { name: 'Medium', value: 'medium' },
            { name: 'High', value: 'high' },
            { name: 'Critical', value: 'critical' },
          )
      )
      .addStringOption((opt) => opt.setName('due_date').setDescription('Due date (YYYY-MM-DD)'))
      .addStringOption((opt) => opt.setName('description').setDescription('Task description'))
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('List tasks')
      .addUserOption((opt) => opt.setName('assignee').setDescription('Filter by assignee'))
      .addStringOption((opt) =>
        opt.setName('status').setDescription('Filter by status')
          .addChoices(...STATUSES.map(s => ({ name: STATUS_LABELS[s], value: s })))
      )
      .addStringOption((opt) =>
        opt.setName('priority').setDescription('Filter by priority')
          .addChoices(...PRIORITIES.map(p => ({ name: PRIORITY_LABELS[p], value: p })))
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('Edit a task')
      .addIntegerOption((opt) => opt.setName('id').setDescription('Task ID').setRequired(true))
      .addStringOption((opt) => opt.setName('title').setDescription('New title'))
      .addStringOption((opt) =>
        opt.setName('status').setDescription('New status')
          .addChoices(...STATUSES.map(s => ({ name: STATUS_LABELS[s], value: s })))
      )
      .addStringOption((opt) =>
        opt.setName('priority').setDescription('New priority')
          .addChoices(...PRIORITIES.map(p => ({ name: PRIORITY_LABELS[p], value: p })))
      )
      .addUserOption((opt) => opt.setName('assignee').setDescription('New assignee'))
      .addStringOption((opt) => opt.setName('due_date').setDescription('New due date (YYYY-MM-DD)'))
  )
  .addSubcommand((sub) =>
    sub
      .setName('status')
      .setDescription('Quick status update')
      .addIntegerOption((opt) => opt.setName('id').setDescription('Task ID').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('new_status').setDescription('New status').setRequired(true)
          .addChoices(...STATUSES.map(s => ({ name: STATUS_LABELS[s], value: s })))
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('view')
      .setDescription('View task details')
      .addIntegerOption((opt) => opt.setName('id').setDescription('Task ID').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('delete')
      .setDescription('Cancel a task (soft delete)')
      .addIntegerOption((opt) => opt.setName('id').setDescription('Task ID').setRequired(true))
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'create': return handleCreate(interaction);
    case 'list': return handleList(interaction);
    case 'edit': return handleEdit(interaction);
    case 'status': return handleStatus(interaction);
    case 'view': return handleView(interaction);
    case 'delete': return handleDelete(interaction);
  }
}

// --- Pagination button handler ---

// In-memory pagination state (keyed by message ID)
const paginationState = new Map();

export async function handleTaskPagination(interaction) {
  if (!interaction.customId.startsWith('task_page:')) return false;

  const [, direction, messageId] = interaction.customId.split(':');
  const state = paginationState.get(messageId);

  if (!state) {
    await interaction.reply({ content: 'This list has expired. Run `/task list` again.', ephemeral: true });
    return true;
  }

  state.page += direction === 'next' ? 1 : -1;
  if (state.page < 0) state.page = 0;

  const { embed, row, total } = buildTaskListEmbed(state.filters, state.page);
  state.total = total;

  await interaction.update({ embeds: [embed], components: row ? [row] : [] });
  return true;
}

function buildTaskListEmbed(filters, page) {
  const limit = 10;
  const offset = page * limit;
  const { tasks, total } = getTasksFiltered({ ...filters, limit, offset });

  const totalPages = Math.ceil(total / limit);

  const embed = new EmbedBuilder()
    .setTitle('Tasks')
    .setColor(0x5865F2)
    .setFooter({ text: `Page ${page + 1}/${totalPages || 1} — ${total} task${total !== 1 ? 's' : ''} total` });

  if (tasks.length === 0) {
    embed.setDescription('No tasks found matching your filters.');
  } else {
    const lines = tasks.map(t => {
      const pri = PRIORITY_LABELS[t.priority]?.[0] ?? '?';
      const due = t.due_date ? ` | Due: ${t.due_date}` : '';
      return `\`#${t.id}\` [${pri}] **${t.title}** — <@${t.assignee_id}> · ${STATUS_LABELS[t.status] ?? t.status}${due}`;
    });
    embed.setDescription(lines.join('\n'));
  }

  let row = null;
  if (totalPages > 1) {
    row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`task_page:prev:placeholder`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(`task_page:next:placeholder`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1),
    );
  }

  return { embed, row, total };
}

// --- Handlers ---

async function handleCreate(interaction) {
  const title = interaction.options.getString('title');
  const assignee = interaction.options.getUser('assignee');
  const priority = interaction.options.getString('priority') ?? 'medium';
  const dueDate = interaction.options.getString('due_date') ?? null;
  const description = interaction.options.getString('description') ?? null;

  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return interaction.reply({ content: 'Invalid date format. Use YYYY-MM-DD.', ephemeral: true });
  }

  const id = createTask({
    guildId: interaction.guild.id,
    channelId: interaction.channel.id,
    title,
    description,
    assigneeId: assignee.id,
    createdBy: interaction.user.id,
    priority,
    dueDate,
  });

  const embed = new EmbedBuilder()
    .setTitle(`Task #${id} Created`)
    .setColor(PRIORITY_COLORS[priority])
    .addFields(
      { name: 'Title', value: title },
      { name: 'Assignee', value: `<@${assignee.id}>`, inline: true },
      { name: 'Priority', value: PRIORITY_LABELS[priority], inline: true },
      { name: 'Status', value: STATUS_LABELS.todo, inline: true },
    );

  if (dueDate) embed.addFields({ name: 'Due Date', value: dueDate, inline: true });
  if (description) embed.addFields({ name: 'Description', value: description });

  await interaction.reply({ embeds: [embed] });
}

async function handleList(interaction) {
  const assignee = interaction.options.getUser('assignee');
  const status = interaction.options.getString('status');
  const priority = interaction.options.getString('priority');

  const filters = {
    guildId: interaction.guild.id,
    assigneeId: assignee?.id,
    status,
    priority,
  };

  const page = 0;
  const { embed, row, total } = buildTaskListEmbed(filters, page);

  const reply = await interaction.reply({ embeds: [embed], components: row ? [row] : [], fetchReply: true });

  // Update button custom IDs with the actual message ID and store state
  if (row && total > 10) {
    const updatedRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`task_page:prev:${reply.id}`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`task_page:next:${reply.id}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(total <= 10),
    );

    await interaction.editReply({ components: [updatedRow] });

    paginationState.set(reply.id, { filters, page, total });

    // Auto-expire pagination state after 10 minutes
    setTimeout(() => paginationState.delete(reply.id), 10 * 60 * 1000);
  }
}

async function handleEdit(interaction) {
  const id = interaction.options.getInteger('id');
  const task = getTaskById(id);

  if (!task || task.guild_id !== interaction.guild.id) {
    return interaction.reply({ content: `Task #${id} not found.`, ephemeral: true });
  }

  const fields = {};

  const title = interaction.options.getString('title');
  if (title) fields.title = title;

  const status = interaction.options.getString('status');
  if (status) fields.status = status;

  const priority = interaction.options.getString('priority');
  if (priority) fields.priority = priority;

  const assignee = interaction.options.getUser('assignee');
  if (assignee) fields.assignee_id = assignee.id;

  const dueDate = interaction.options.getString('due_date');
  if (dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return interaction.reply({ content: 'Invalid date format. Use YYYY-MM-DD.', ephemeral: true });
    }
    fields.due_date = dueDate;
  }

  if (Object.keys(fields).length === 0) {
    return interaction.reply({ content: 'No fields to update.', ephemeral: true });
  }

  updateTask(id, fields);
  const updated = getTaskById(id);

  const embed = new EmbedBuilder()
    .setTitle(`Task #${id} Updated`)
    .setColor(PRIORITY_COLORS[updated.priority])
    .addFields(
      { name: 'Title', value: updated.title },
      { name: 'Assignee', value: `<@${updated.assignee_id}>`, inline: true },
      { name: 'Priority', value: PRIORITY_LABELS[updated.priority] ?? updated.priority, inline: true },
      { name: 'Status', value: STATUS_LABELS[updated.status] ?? updated.status, inline: true },
    );

  if (updated.due_date) embed.addFields({ name: 'Due Date', value: updated.due_date, inline: true });

  await interaction.reply({ embeds: [embed] });
}

async function handleStatus(interaction) {
  const id = interaction.options.getInteger('id');
  const newStatus = interaction.options.getString('new_status');

  const task = getTaskById(id);
  if (!task || task.guild_id !== interaction.guild.id) {
    return interaction.reply({ content: `Task #${id} not found.`, ephemeral: true });
  }

  updateTask(id, { status: newStatus });

  await interaction.reply(
    `Task **#${id}** status updated: ${STATUS_LABELS[task.status]} → **${STATUS_LABELS[newStatus]}**`
  );
}

async function handleView(interaction) {
  const id = interaction.options.getInteger('id');
  const task = getTaskById(id);

  if (!task || task.guild_id !== interaction.guild.id) {
    return interaction.reply({ content: `Task #${id} not found.`, ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle(`Task #${task.id}`)
    .setColor(PRIORITY_COLORS[task.priority])
    .addFields(
      { name: 'Title', value: task.title },
      { name: 'Assignee', value: `<@${task.assignee_id}>`, inline: true },
      { name: 'Created By', value: `<@${task.created_by}>`, inline: true },
      { name: 'Status', value: STATUS_LABELS[task.status] ?? task.status, inline: true },
      { name: 'Priority', value: PRIORITY_LABELS[task.priority] ?? task.priority, inline: true },
      { name: 'Source', value: task.source, inline: true },
    );

  if (task.due_date) embed.addFields({ name: 'Due Date', value: task.due_date, inline: true });
  if (task.description) embed.addFields({ name: 'Description', value: task.description });

  embed.addFields(
    { name: 'Created', value: task.created_at, inline: true },
    { name: 'Updated', value: task.updated_at, inline: true },
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleDelete(interaction) {
  const id = interaction.options.getInteger('id');
  const task = getTaskById(id);

  if (!task || task.guild_id !== interaction.guild.id) {
    return interaction.reply({ content: `Task #${id} not found.`, ephemeral: true });
  }

  // Permission check: creator or Manage Server
  const isCreator = task.created_by === interaction.user.id;
  const hasManageServer = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
  if (!isCreator && !hasManageServer) {
    return interaction.reply({
      content: 'Only the task creator or users with Manage Server permission can delete this.',
      ephemeral: true,
    });
  }

  softDeleteTask(id);
  await interaction.reply(`Task **#${id}** has been cancelled.`);
}
