import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { VoiceSession, getSession } from '../services/voice.js';

export const data = new SlashCommandBuilder()
  .setName('transcribe')
  .setDescription('Voice transcription controls')
  .addSubcommand((sub) =>
    sub.setName('start').setDescription('Join your voice channel and start transcribing')
  )
  .addSubcommand((sub) =>
    sub.setName('stop').setDescription('Stop transcribing and post the full transcript')
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'start') {
    return handleStart(interaction);
  }
  if (sub === 'stop') {
    return handleStop(interaction);
  }
}

async function handleStart(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    return interaction.reply({ content: 'You need to be in a voice channel first.', ephemeral: true });
  }

  const existing = getSession(interaction.guild.id);
  if (existing) {
    return interaction.reply({ content: 'A transcription session is already active in this server.', ephemeral: true });
  }

  await interaction.reply(
    '🎙️ **Transcription starting.** Everything said in the voice channel will be transcribed and posted here.\n' +
    '> By staying in the channel, participants consent to being transcribed.\n' +
    '> Use `/transcribe stop` to end the session.'
  );

  const session = new VoiceSession(interaction.guild, voiceChannel, interaction.channel);
  await session.start();
}

async function handleStop(interaction) {
  const session = getSession(interaction.guild.id);
  if (!session) {
    return interaction.reply({ content: 'No active transcription session.', ephemeral: true });
  }

  await interaction.reply('Stopping transcription...');
  await session.stop();
}
