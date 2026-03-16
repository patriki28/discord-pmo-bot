import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createTask } from './database.js';

// In-memory store for pending confirmations (5-min TTL)
const pendingCandidates = new Map();

// Clean expired candidates every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, candidate] of pendingCandidates) {
    if (now - candidate.createdAt > 5 * 60 * 1000) {
      pendingCandidates.delete(key);
    }
  }
}, 60_000);

const PATTERNS = [
  // "action item: ..." / "task: ..." / "TODO: ..."
  /(?:action item|task|todo)\s*:\s*(.+)/i,
  // "@user needs to/should/will/must ..."
  /(\S+)\s+(?:needs?\s+to|should|will|must)\s+(.+)/i,
  // "assign to @user ..."
  /assign\s+(?:to\s+)?(\S+)\s+(.+)/i,
  // "@user, please ..."
  /(\S+),?\s+please\s+(.+)/i,
];

/**
 * Scan transcription text for action item candidates.
 * Returns array of { assigneeName, assigneeId, title, originalText }
 */
export function scan(text, guild) {
  const candidates = [];
  const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);

  for (const sentence of sentences) {
    for (const pattern of PATTERNS) {
      const match = sentence.match(pattern);
      if (!match) continue;

      let assigneeName = null;
      let title = null;

      if (pattern === PATTERNS[0]) {
        // "action item: do the thing" — no assignee detected
        title = match[1].trim();
      } else if (pattern === PATTERNS[2]) {
        // "assign to user do the thing"
        assigneeName = match[1].replace(/^@/, '');
        title = match[2].trim();
      } else {
        // Patterns with "user needs to/should/..." or "user, please ..."
        assigneeName = match[1].replace(/^@/, '');
        title = match[2].trim();
      }

      // Skip very short titles
      if (!title || title.length < 3) continue;

      // Resolve name to user ID (best-effort)
      let assigneeId = null;
      if (assigneeName && guild) {
        const lowerName = assigneeName.toLowerCase();
        const member = guild.members.cache.find(
          m => m.displayName.toLowerCase() === lowerName || m.user.username.toLowerCase() === lowerName
        );
        if (member) assigneeId = member.id;
      }

      candidates.push({
        assigneeName: assigneeName ?? null,
        assigneeId,
        title,
        originalText: sentence,
      });

      break; // Only match first pattern per sentence
    }
  }

  return candidates;
}

/**
 * Post a confirmation embed for a detected task candidate.
 */
export async function postTaskConfirmation(channel, candidate, guildId) {
  const candidateId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const embed = new EmbedBuilder()
    .setTitle('Action Item Detected')
    .setDescription(`**"${candidate.title}"**`)
    .addFields(
      { name: 'Assignee', value: candidate.assigneeId ? `<@${candidate.assigneeId}>` : (candidate.assigneeName ?? 'Unknown'), inline: true },
      { name: 'Source', value: 'Voice Transcription', inline: true },
    )
    .setColor(0x5865F2)
    .setFooter({ text: 'Expires in 5 minutes' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`task_confirm:${candidateId}`)
      .setLabel('Create Task')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`task_reject:${candidateId}`)
      .setLabel('Dismiss')
      .setStyle(ButtonStyle.Secondary),
  );

  const message = await channel.send({ embeds: [embed], components: [row] });

  pendingCandidates.set(candidateId, {
    ...candidate,
    guildId,
    channelId: channel.id,
    messageId: message.id,
    createdAt: Date.now(),
  });
}

/**
 * Handle a button interaction for task confirmation/rejection.
 * Returns true if handled, false otherwise.
 */
export async function handleTaskButton(interaction) {
  const customId = interaction.customId;

  if (!customId.startsWith('task_confirm:') && !customId.startsWith('task_reject:')) {
    return false;
  }

  const [action, candidateId] = customId.split(':');
  const candidate = pendingCandidates.get(candidateId);

  if (!candidate) {
    await interaction.reply({ content: 'This action item has expired.', ephemeral: true });
    return true;
  }

  if (action === 'task_reject') {
    pendingCandidates.delete(candidateId);

    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x95A5A6)
      .setTitle('Action Item Dismissed')
      .setFooter({ text: `Dismissed by ${interaction.user.displayName}` });

    await interaction.update({ embeds: [embed], components: [] });
    return true;
  }

  // task_confirm
  if (!candidate.assigneeId) {
    // Need user to select an assignee
    const { UserSelectMenuBuilder, ActionRowBuilder: MenuRow } = await import('discord.js');
    const selectRow = new MenuRow().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`task_assignee:${candidateId}`)
        .setPlaceholder('Select an assignee')
        .setMinValues(1)
        .setMaxValues(1)
    );

    await interaction.reply({ content: 'No assignee was detected. Please select one:', components: [selectRow], ephemeral: true });
    return true;
  }

  // Create the task
  const taskId = createTask({
    guildId: candidate.guildId,
    channelId: candidate.channelId,
    title: candidate.title,
    assigneeId: candidate.assigneeId,
    createdBy: interaction.user.id,
    source: 'transcription',
  });

  pendingCandidates.delete(candidateId);

  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(0x2ECC71)
    .setTitle(`Task #${taskId} Created`)
    .setFooter({ text: `Created by ${interaction.user.displayName}` });

  await interaction.update({ embeds: [embed], components: [] });
  return true;
}

/**
 * Handle user-select menu for assigning a task when auto-detection failed.
 * Returns true if handled, false otherwise.
 */
export async function handleTaskAssigneeSelect(interaction) {
  if (!interaction.customId.startsWith('task_assignee:')) return false;

  const candidateId = interaction.customId.split(':')[1];
  const candidate = pendingCandidates.get(candidateId);

  if (!candidate) {
    await interaction.reply({ content: 'This action item has expired.', ephemeral: true });
    return true;
  }

  const assigneeId = interaction.values[0];

  const taskId = createTask({
    guildId: candidate.guildId,
    channelId: candidate.channelId,
    title: candidate.title,
    assigneeId,
    createdBy: interaction.user.id,
    source: 'transcription',
  });

  pendingCandidates.delete(candidateId);

  await interaction.update({
    content: `Task **#${taskId}** created and assigned to <@${assigneeId}>.`,
    components: [],
  });

  // Update the original confirmation embed
  try {
    const channel = interaction.client.channels.cache.get(candidate.channelId);
    const message = await channel?.messages.fetch(candidate.messageId);
    if (message) {
      const embed = EmbedBuilder.from(message.embeds[0])
        .setColor(0x2ECC71)
        .setTitle(`Task #${taskId} Created`)
        .setFooter({ text: `Created by ${interaction.user.displayName}` });
      await message.edit({ embeds: [embed], components: [] });
    }
  } catch {
    // Best-effort embed update
  }

  return true;
}
