import 'dotenv/config';

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'WHISPER_CPP_PATH', 'WHISPER_MODEL_PATH'];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

export const config = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  whisperPath: process.env.WHISPER_CPP_PATH,
  whisperModel: process.env.WHISPER_MODEL_PATH,
};
