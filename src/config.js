import 'dotenv/config';
import { existsSync } from 'fs';

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const whisperPath = process.env.WHISPER_CPP_PATH || null;
const whisperModel = process.env.WHISPER_MODEL_PATH || null;

const profile = process.env.TRANSCRIBE_PROFILE || 'balanced';
const profileDefaults = {
  accuracy: {
    threads: 6,
    language: 'en',
    silenceMs: 1400,
    minAudioMs: 250,
    maxSegmentMs: 20000,
    overlapMs: 600,
    retries: 2,
    timeoutMs: 45000,
    normalizeAudio: true,
    downmixMono: true,
    queueConcurrency: 1,
  },
  balanced: {
    threads: 4,
    language: 'en',
    silenceMs: 1000,
    minAudioMs: 180,
    maxSegmentMs: 15000,
    overlapMs: 350,
    retries: 1,
    timeoutMs: 35000,
    normalizeAudio: true,
    downmixMono: true,
    queueConcurrency: 1,
  },
  fast: {
    threads: 2,
    language: 'auto',
    silenceMs: 800,
    minAudioMs: 120,
    maxSegmentMs: 10000,
    overlapMs: 150,
    retries: 0,
    timeoutMs: 25000,
    normalizeAudio: false,
    downmixMono: true,
    queueConcurrency: 1,
  },
};

const resolvedProfile = profileDefaults[profile] ?? profileDefaults.balanced;

const transcription = {
  profile,
  language: process.env.TRANSCRIBE_LANGUAGE || resolvedProfile.language,
  threads: Number(process.env.TRANSCRIBE_THREADS || resolvedProfile.threads),
  timeoutMs: Number(process.env.TRANSCRIBE_TIMEOUT_MS || resolvedProfile.timeoutMs),
  retries: Number(process.env.TRANSCRIBE_RETRIES || resolvedProfile.retries),
  queueConcurrency: Number(process.env.TRANSCRIBE_QUEUE_CONCURRENCY || resolvedProfile.queueConcurrency),
  silenceMs: Number(process.env.TRANSCRIBE_SILENCE_MS || resolvedProfile.silenceMs),
  minAudioMs: Number(process.env.TRANSCRIBE_MIN_AUDIO_MS || resolvedProfile.minAudioMs),
  maxSegmentMs: Number(process.env.TRANSCRIBE_MAX_SEGMENT_MS || resolvedProfile.maxSegmentMs),
  overlapMs: Number(process.env.TRANSCRIBE_OVERLAP_MS || resolvedProfile.overlapMs),
  normalizeAudio: (process.env.TRANSCRIBE_NORMALIZE_AUDIO ?? String(resolvedProfile.normalizeAudio)) === 'true',
  downmixMono: (process.env.TRANSCRIBE_DOWNMIX_MONO ?? String(resolvedProfile.downmixMono)) === 'true',
};

export const config = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  whisperPath,
  whisperModel,
  transcription,
  transcriptsDir: process.env.TRANSCRIPTS_DIR || './transcripts',
};

export function validateWhisperConfig() {
  if (!whisperPath) {
    throw new Error('Missing required env var: WHISPER_CPP_PATH');
  }
  if (!whisperModel) {
    throw new Error('Missing required env var: WHISPER_MODEL_PATH');
  }
  if (!existsSync(whisperPath)) {
    throw new Error(
      `Whisper executable not found at: ${whisperPath}\n` +
      '  → Update WHISPER_CPP_PATH in .env with the actual path to whisper-cli\n' +
      '  → See README or docs/DEPLOYMENT.md for whisper.cpp setup'
    );
  }
  if (!existsSync(whisperModel)) {
    throw new Error(
      `Whisper model file not found at: ${whisperModel}\n` +
      '  → Update WHISPER_MODEL_PATH in .env with the actual path to the GGML model\n' +
      '  → Run: cd whisper.cpp && bash models/download-ggml-model.sh medium'
    );
  }
}
