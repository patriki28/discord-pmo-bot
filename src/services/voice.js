import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  EndBehaviorType,
} from '@discordjs/voice';
import prism from 'prism-media';
import { UserAudioBuffer } from '../utils/audio.js';
import { transcribe } from './transcription.js';

// One session per guild
const sessions = new Map();

export function getSession(guildId) {
  return sessions.get(guildId);
}

export class VoiceSession {
  constructor(guild, voiceChannel, textChannel) {
    this.guild = guild;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.connection = null;
    this.userBuffers = new Map();
    this.transcript = [];
    this.active = false;
  }

  async start() {
    if (sessions.has(this.guild.id)) {
      throw new Error('A transcription session is already active in this server.');
    }

    this.connection = joinVoiceChannel({
      channelId: this.voiceChannel.id,
      guildId: this.guild.id,
      adapterCreator: this.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });

    this.active = true;
    sessions.set(this.guild.id, this);

    // Handle reconnection
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch {
        this.stop();
      }
    });

    // Listen for speaking users
    this.connection.receiver.speaking.on('start', (userId) => {
      if (!this.active) return;
      this.subscribeToUser(userId);
    });
  }

  subscribeToUser(userId) {
    const receiver = this.connection.receiver;

    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1000,
      },
    });

    const decoder = new prism.opus.Decoder({
      rate: 48000,
      channels: 2,
      frameSize: 960,
    });

    if (!this.userBuffers.has(userId)) {
      // Resolve username
      const member = this.guild.members.cache.get(userId);
      const username = member?.displayName ?? `User-${userId.slice(0, 6)}`;
      this.userBuffers.set(userId, new UserAudioBuffer(userId, username));
    }

    const buffer = this.userBuffers.get(userId);

    opusStream.pipe(decoder);

    decoder.on('data', (pcmChunk) => {
      buffer.push(pcmChunk);
    });

    decoder.on('end', () => {
      if (!this.active) return;
      this.flushUser(userId);
    });

    decoder.on('error', (err) => {
      console.error(`Decoder error for ${userId}:`, err.message);
    });
  }

  async flushUser(userId) {
    const buffer = this.userBuffers.get(userId);
    if (!buffer?.hasData) return;

    const pcm = buffer.flush();
    if (!pcm || pcm.length < 9600) return; // Skip very short audio (<100ms)

    try {
      const result = await transcribe(pcm, buffer.username);
      if (result) {
        this.transcript.push(result);
        await this.textChannel.send(`**${result.username}:** ${result.text}`);
      }
    } catch (err) {
      console.error('Transcription failed:', err.message);
    }
  }

  async stop() {
    this.active = false;
    sessions.delete(this.guild.id);

    // Flush remaining audio
    for (const userId of this.userBuffers.keys()) {
      await this.flushUser(userId);
    }

    // Post full transcript
    if (this.transcript.length > 0) {
      const lines = this.transcript.map(
        (t) => `[${new Date(t.timestamp).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })}] **${t.username}:** ${t.text}`
      );

      // Split into chunks if too long (Discord 2000 char limit)
      const chunks = [];
      let current = '**Full Transcript:**\n';
      for (const line of lines) {
        if (current.length + line.length + 1 > 1950) {
          chunks.push(current);
          current = '';
        }
        current += line + '\n';
      }
      if (current.trim()) chunks.push(current);

      for (const chunk of chunks) {
        await this.textChannel.send(chunk);
      }
    }

    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
  }
}
