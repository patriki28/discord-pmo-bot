import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');

/**
 * TC-C1: Config exits when required env vars are missing.
 * Runs config load in a subprocess with missing vars to avoid process.exit in test runner.
 * Uses temp cwd without .env so dotenv does not load vars from project.
 */
describe('config', () => {
  it('TC-C1: exits when required env vars missing', () => {
    const tmpCwd = mkdtempSync(path.join(tmpdir(), 'pmo-config-test-'));
    const env = { ...process.env };
    env.DISCORD_TOKEN = '';
    env.DISCORD_CLIENT_ID = '';
    delete env.WHISPER_CPP_PATH;
    delete env.WHISPER_MODEL_PATH;
    const configPath = path.join(projectRoot, 'src', 'config.js');
    const configUrl = pathToFileURL(configPath).href;
    const result = spawnSync(process.execPath, [
      '--input-type=module',
      '-e',
      `import('${configUrl}')`,
    ], {
      cwd: tmpCwd,
      env,
      encoding: 'utf-8',
      timeout: 5000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr || result.stdout || '').toMatch(/Missing required env var/);
  });
});
