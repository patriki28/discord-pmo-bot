import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { data as transcribeData } from './transcribe.js';
import { data as scheduleData } from './schedule.js';
import { data as taskData } from './task.js';
import { data as taskReminderData } from './taskReminder.js';

const commands = [transcribeData.toJSON(), scheduleData.toJSON(), taskData.toJSON(), taskReminderData.toJSON()];

const rest = new REST({ version: '10' }).setToken(config.discordToken);

console.log(`Registering ${commands.length} slash commands...`);

async function detectGuildIds() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  await new Promise((resolve, reject) => {
    const onReady = () => resolve();
    const onError = (err) => reject(err);
    client.once('ready', onReady);
    client.once('error', onError);
    client.login(config.discordToken).catch(reject);
  });

  try {
    const guildIds = client.guilds.cache.map((g) => g.id);
    return guildIds;
  } finally {
    client.destroy();
  }
}

try {
  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
    console.log(`Slash commands registered successfully for guild ${config.guildId}.`);
  } else {
    const guildIds = await detectGuildIds();
    if (guildIds.length === 0) {
      await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
      console.log('Bot is not in any servers yet; registered commands globally (can take up to an hour to appear).');
    } else {
      for (const guildId of guildIds) {
        await rest.put(Routes.applicationGuildCommands(config.clientId, guildId), { body: commands });
        console.log(`Slash commands registered successfully for guild ${guildId}.`);
      }
      console.log('Tip: once you’re ready for production, remove guild-specific deploy and deploy globally.');
    }
  }
} catch (err) {
  console.error('Failed to register commands:', err);
  process.exit(1);
}
