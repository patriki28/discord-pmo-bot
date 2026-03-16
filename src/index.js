import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from './config.js';
import { startScheduler } from './services/scheduler.js';
import { handleTaskButton, handleTaskAssigneeSelect } from './services/taskDetector.js';
import { handleTaskPagination } from './commands/task.js';

import * as transcribeCmd from './commands/transcribe.js';
import * as scheduleCmd from './commands/schedule.js';
import * as taskCmd from './commands/task.js';
import * as taskReminderCmd from './commands/taskReminder.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

// Load commands
const commands = new Collection();
commands.set(transcribeCmd.data.name, transcribeCmd);
commands.set(scheduleCmd.data.name, scheduleCmd);
commands.set(taskCmd.data.name, taskCmd);
commands.set(taskReminderCmd.data.name, taskReminderCmd);

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  // Button interactions
  if (interaction.isButton()) {
    try {
      if (await handleTaskButton(interaction)) return;
      if (await handleTaskPagination(interaction)) return;
    } catch (err) {
      console.error('Button interaction error:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
      }
    }
    return;
  }

  // User select menu interactions
  if (interaction.isUserSelectMenu()) {
    try {
      if (await handleTaskAssigneeSelect(interaction)) return;
    } catch (err) {
      console.error('Select menu interaction error:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
      }
    }
    return;
  }

  // Slash commands
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error executing /${interaction.commandName}:`, err);
    const reply = { content: 'An error occurred while executing this command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

client.once('ready', () => {
  console.log(`Ready — logged in as ${client.user.tag}`);
  startScheduler(client);
});

// Global error handlers
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

client.login(config.discordToken);
