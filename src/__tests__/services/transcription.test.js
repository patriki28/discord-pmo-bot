import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../config.js', () => ({
  config: { whisperPath: '/fake/whisper', whisperModel: '/fake/model.bin' },
  validateWhisperConfig: vi.fn(),
}));

import { execFile } from 'child_process';
import { transcribe } from '../../services/transcription.js';

describe('transcription service', () => {
  beforeEach(() => {
    vi.mocked(execFile).mockReset();
  });

  it('TC-T8: returns null for empty/whitespace whisper output', async () => {
    vi.mocked(execFile).mockImplementation((cmd, args, opts, cb) => {
      cb(null, '', '');
    });
    const result = await transcribe(Buffer.alloc(10000), 'Alice');
    expect(result).toBeNull();
  });

  it('TC-T8: returns null when whisper returns only whitespace', async () => {
    vi.mocked(execFile).mockImplementation((cmd, args, opts, cb) => {
      cb(null, '   \n\t  ', '');
    });
    const result = await transcribe(Buffer.alloc(10000), 'Alice');
    expect(result).toBeNull();
  });

  it('TC-T9: returns {username, text, timestamp} for valid output', async () => {
    vi.mocked(execFile).mockImplementation((cmd, args, opts, cb) => {
      cb(null, 'Hello world', '');
    });
    const result = await transcribe(Buffer.alloc(10000), 'Bob');
    expect(result).not.toBeNull();
    expect(result.username).toBe('Bob');
    expect(result.text).toBe('Hello world');
    expect(result.timestamp).toBeDefined();
    expect(typeof result.timestamp).toBe('string');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('returns null when whisper errors', async () => {
    vi.mocked(execFile).mockImplementation((cmd, args, opts, cb) => {
      cb(new Error('Whisper failed'), null, 'stderr');
    });
    const result = await transcribe(Buffer.alloc(10000), 'Alice');
    expect(result).toBeNull();
  });
});
