import { defineConfig } from 'vitest/config';

// Required env vars for config.js (runs at import time)
process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'test-token';
process.env.DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'test-client-id';
process.env.WHISPER_CPP_PATH = process.env.WHISPER_CPP_PATH || '/fake/whisper-cli';
process.env.WHISPER_MODEL_PATH = process.env.WHISPER_MODEL_PATH || '/fake/model.bin';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
