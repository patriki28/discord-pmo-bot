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

export const config = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  whisperPath,
  whisperModel,
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
