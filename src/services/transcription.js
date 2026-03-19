import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { config, validateWhisperConfig } from '../config.js';
import { pcmToWav } from '../utils/audio.js';

let activeJobs = 0;
const queuedJobs = [];

export async function transcribe(pcmBuffer, username, options = {}) {
  const wavBuffer = pcmToWav(pcmBuffer);
  const tmpPath = path.join(tmpdir(), `pmo-${randomUUID()}.wav`);
  const startedAt = Date.now();

  try {
    await writeFile(tmpPath, wavBuffer);

    const text = await enqueueTranscription(() => runWhisperWithRetry(tmpPath, options));
    if (!text || text.trim().length === 0) return null;

    const latencyMs = Date.now() - startedAt;
    logTelemetry('transcription_success', {
      username,
      profile: config.transcription.profile,
      latencyMs,
      chunkBytes: pcmBuffer.length,
    });

    return {
      username,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      metadata: {
        latencyMs,
        profile: config.transcription.profile,
      },
    };
  } catch (err) {
    logTelemetry('transcription_exception', {
      username,
      error: err.message,
      profile: config.transcription.profile,
    });
    return null;
  } finally {
    unlink(tmpPath).catch(() => {});
  }
}

function enqueueTranscription(task) {
  const concurrency = Math.max(1, Number(config.transcription.queueConcurrency || 1));
  return new Promise((resolve, reject) => {
    const run = async () => {
      activeJobs += 1;
      const queueWaitMs = Date.now();
      try {
        const result = await task();
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        activeJobs -= 1;
        const next = queuedJobs.shift();
        if (next) next();
        logTelemetry('transcription_queue', {
          activeJobs,
          queueDepth: queuedJobs.length,
          queueWaitMs: Date.now() - queueWaitMs,
          concurrency,
        });
      }
    };

    if (activeJobs < concurrency) {
      run();
    } else {
      queuedJobs.push(run);
    }
  });
}

async function runWhisperWithRetry(wavPath, options) {
  const retries = Math.max(0, Number(config.transcription.retries || 0));
  let attempt = 0;
  while (attempt <= retries) {
    const text = await runWhisper(wavPath, options);
    if (text || attempt === retries) {
      if (!text) {
        logTelemetry('transcription_empty_after_retries', {
          attempts: attempt + 1,
          retries,
        });
      }
      return text;
    }
    attempt += 1;
    await sleep(150 * attempt);
  }
  return null;
}

function runWhisper(wavPath, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      validateWhisperConfig();
    } catch (err) {
      console.error(err.message);
      return resolve(null);
    }

    const language = options.language || config.transcription.language || 'auto';
    const prompt = options.prompt && options.prompt.trim().length > 0
      ? options.prompt.trim().slice(-200)
      : null;
    const args = [
      '-m', config.whisperModel,
      '-f', wavPath,
      '-l', language,
      '--no-timestamps',
      '-t', String(config.transcription.threads),
    ];
    if (prompt) {
      args.push('--prompt', prompt);
    }

    execFile(
      config.whisperPath,
      args,
      { timeout: Number(config.transcription.timeoutMs || 30000) },
      (err, stdout, stderr) => {
        if (err) {
          const msg = err.code === 'ENOENT'
            ? `Whisper binary not found at: ${config.whisperPath}\n  → Update WHISPER_CPP_PATH in .env to the actual path (see README for whisper.cpp setup)`
            : `Whisper error: ${err.message}`;
          console.error(msg);
          logTelemetry('transcription_failure', {
            code: err.code || 'unknown',
            message: err.message,
            language,
          });
          return resolve(null);
        }
        resolve(stdout);
      }
    );
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logTelemetry(event, fields) {
  const payload = {
    event,
    at: new Date().toISOString(),
    ...fields,
  };
  console.log(`[transcription.telemetry] ${JSON.stringify(payload)}`);
}
