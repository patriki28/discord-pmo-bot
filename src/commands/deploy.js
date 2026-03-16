import { REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { data as transcribeData } from './transcribe.js';
import { data as scheduleData } from './schedule.js';

const commands = [transcribeData.toJSON(), scheduleData.toJSON()];

const rest = new REST({ version: '10' }).setToken(config.discordToken);

console.log(`Registering ${commands.length} slash commands...`);

try {
  await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
  console.log('Slash commands registered successfully.');
} catch (err) {
  console.error('Failed to register commands:', err);
  process.exit(1);
}
