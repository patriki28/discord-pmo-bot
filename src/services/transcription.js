import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { config, validateWhisperConfig } from '../config.js';
import { pcmToWav } from '../utils/audio.js';

export async function transcribe(pcmBuffer, username) {
  const wavBuffer = pcmToWav(pcmBuffer);
  const tmpPath = path.join(tmpdir(), `pmo-${randomUUID()}.wav`);

  try {
    await writeFile(tmpPath, wavBuffer);

    const text = await runWhisper(tmpPath);
    if (!text || text.trim().length === 0) return null;

    return {
      username,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };
  } finally {
    unlink(tmpPath).catch(() => {});
  }
}

function runWhisper(wavPath) {
  return new Promise((resolve, reject) => {
    try {
      validateWhisperConfig();
    } catch (err) {
      console.error(err.message);
      return resolve(null);
    }

    execFile(
      config.whisperPath,
      [
        '-m', config.whisperModel,
        '-f', wavPath,
        '-l', 'auto',
        '--no-timestamps',
        '-t', '4',
      ],
      { timeout: 30000 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = err.code === 'ENOENT'
            ? `Whisper binary not found at: ${config.whisperPath}\n  → Update WHISPER_CPP_PATH in .env to the actual path (see README for whisper.cpp setup)`
            : `Whisper error: ${err.message}`;
          console.error(msg);
          return resolve(null);
        }
        resolve(stdout);
      }
    );
  });
}
