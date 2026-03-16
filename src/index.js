import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from './config.js';
import { startScheduler } from './services/scheduler.js';

import * as transcribeCmd from './commands/transcribe.js';
import * as scheduleCmd from './commands/schedule.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Load commands
const commands = new Collection();
commands.set(transcribeCmd.data.name, transcribeCmd);
commands.set(scheduleCmd.data.name, scheduleCmd);

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
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
