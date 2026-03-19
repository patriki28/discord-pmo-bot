import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  EndBehaviorType,
} from '@discordjs/voice';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import prism from 'prism-media';
import {
  UserAudioBuffer,
  downmixStereoToMono,
  normalizePcm16,
  pcmDurationMs,
} from '../utils/audio.js';
import { config } from '../config.js';
import { transcribe } from './transcription.js';
import { scan, postTaskConfirmation } from './taskDetector.js';

// One session per guild
const sessions = new Map();

const DISCORD_FILE_LIMIT = 8 * 1024 * 1024; // 8MB

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
    this.userContexts = new Map();
    this.userOverlapBuffers = new Map();
    this.transcript = [];
    this.active = false;
    this.startedAt = null;
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
    this.startedAt = new Date();
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

    // Listen for speaking users (guard against double subscription per discordjs#8438)
    this.connection.receiver.speaking.on('start', (userId) => {
      if (!this.active) return;
      if (this.connection.receiver.subscriptions.has(userId)) return;
      this.subscribeToUser(userId);
    });
  }

  subscribeToUser(userId) {
    const receiver = this.connection.receiver;

    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: Number(config.transcription.silenceMs || 1000),
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

    let pcm = buffer.flush();
    if (!pcm || pcm.length < 9600) return;

    // Prepend overlap from previous chunk to improve continuity.
    const overlap = this.userOverlapBuffers.get(userId);
    if (overlap && overlap.length > 0) {
      pcm = Buffer.concat([overlap, pcm]);
    }

    let channels = 2;
    if (config.transcription.downmixMono) {
      pcm = downmixStereoToMono(pcm);
      channels = 1;
    }
    if (config.transcription.normalizeAudio) {
      pcm = normalizePcm16(pcm);
    }

    const durationMs = pcmDurationMs(pcm, channels);
    if (durationMs < Number(config.transcription.minAudioMs || 100)) {
      return;
    }

    const overlapMs = Number(config.transcription.overlapMs || 0);
    if (overlapMs > 0) {
      this.userOverlapBuffers.set(userId, tailByMs(pcm, overlapMs, channels));
    }

    if (durationMs > Number(config.transcription.maxSegmentMs || 30000)) {
      console.log(
        `[transcription.telemetry] ${JSON.stringify({
          event: 'segment_exceeds_target',
          userId,
          durationMs,
          targetMs: Number(config.transcription.maxSegmentMs || 30000),
        })}`
      );
    }

    try {
      const prompt = this.userContexts.get(userId) || null;
      const result = await transcribe(pcm, buffer.username, { prompt });
      if (result) {
        this.userContexts.set(userId, result.text.slice(-200));
        this.transcript.push(result);
        await this.textChannel.send(`**${result.username}:** ${result.text}`);

        // Detect action items from transcription
        try {
          const candidates = scan(result.text, this.guild);
          for (const candidate of candidates) {
            await postTaskConfirmation(this.textChannel, candidate, this.guild.id);
          }
        } catch (err) {
          console.error('Task detection failed:', err.message);
        }
      }
    } catch (err) {
      console.error('Transcription failed:', err.message);
    }
  }

  async stop() {
    this.active = false;
    sessions.delete(this.guild.id);

    try {
      // Flush remaining audio
      for (const userId of this.userBuffers.keys()) {
        await this.flushUser(userId);
      }

      const lines = this.transcript.map(
        (t) => `[${new Date(t.timestamp).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })}] **${t.username}:** ${t.text}`
      );

      if (this.transcript.length > 0) {
        // Write transcript file locally
        const { filePath, content } = buildMeetingMinutesMarkdown(
          this.transcript,
          this.guild,
          this.voiceChannel,
          this.startedAt
        );
        const savedPath = await writeTranscriptFile(filePath, content);
        if (savedPath) {
          // Attach to Discord if under size limit
          const buffer = Buffer.from(content, 'utf-8');
          if (buffer.length <= DISCORD_FILE_LIMIT) {
            try {
              await this.textChannel.send({
                content: '📄 **Meeting Minutes** (saved locally)',
                files: [{ attachment: buffer, name: path.basename(filePath) }],
              });
            } catch (err) {
              console.error('Failed to attach transcript to Discord:', err.message);
            }
          }
        }

        // Post full transcript as messages (chunked)
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
    } finally {
      if (this.connection) {
        this.connection.destroy();
        this.connection = null;
      }
    }
  }
}

function tailByMs(pcmBuffer, overlapMs, channels) {
  if (!pcmBuffer || overlapMs <= 0) return Buffer.alloc(0);
  const sampleRate = 48000;
  const bytesPerSample = 2;
  const bytesPerFrame = channels * bytesPerSample;
  const frames = Math.floor((sampleRate * overlapMs) / 1000);
  const bytes = frames * bytesPerFrame;
  if (bytes <= 0) return Buffer.alloc(0);
  if (bytes >= pcmBuffer.length) return Buffer.from(pcmBuffer);
  return pcmBuffer.subarray(pcmBuffer.length - bytes);
}

/**
 * Build meeting minutes markdown content.
 * @param {Array<{username: string, text: string, timestamp: string}>} transcript
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').VoiceChannel} voiceChannel
 * @param {Date|null} startedAt
 * @returns {{ filePath: string, content: string }}
 */
export function buildMeetingMinutesMarkdown(transcript, guild, voiceChannel, startedAt) {
  const dateStr = new Date().toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const duration = startedAt
    ? `${Math.round((Date.now() - startedAt.getTime()) / 60000)} min`
    : '—';
  const transcriptLines = transcript.map(
    (t) =>
      `[${new Date(t.timestamp).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })}] **${t.username}:** ${t.text}`
  );
  const content = `# Meeting Minutes

**Server:** ${guild.name}
**Channel:** ${voiceChannel?.name ?? 'Unknown'}
**Date:** ${dateStr}
**Duration:** ${duration}

---

## Transcript

${transcriptLines.join('\n')}
`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filePath = path.join(config.transcriptsDir, `transcript-${guild.id}-${timestamp}.md`);
  return { filePath, content };
}

/**
 * Write transcript file to disk. Creates directory if missing.
 * @param {string} filePath
 * @param {string} content
 * @returns {Promise<string|null>} Resolved path or null on error
 */
async function writeTranscriptFile(filePath, content) {
  try {
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, content, 'utf-8');
    return filePath;
  } catch (err) {
    console.error('Failed to write transcript file:', err.message);
    return null;
  }
}
