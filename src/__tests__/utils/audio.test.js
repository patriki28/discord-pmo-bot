import { describe, it, expect } from 'vitest';
import { UserAudioBuffer, pcmToWav } from '../../utils/audio.js';

describe('UserAudioBuffer', () => {
  it('TC-A1: push, flush, and hasData behave correctly', () => {
    const buffer = new UserAudioBuffer('user-1', 'Alice');
    expect(buffer.hasData).toBe(false);

    buffer.push(Buffer.from([1, 2, 3]));
    expect(buffer.hasData).toBe(true);

    buffer.push(Buffer.from([4, 5]));
    const pcm = buffer.flush();
    expect(pcm).toEqual(Buffer.from([1, 2, 3, 4, 5]));
    expect(buffer.hasData).toBe(false);
    expect(buffer.flush()).toBeNull();
  });

  it('returns null from flush when empty', () => {
    const buffer = new UserAudioBuffer('user-1', 'Alice');
    expect(buffer.flush()).toBeNull();
  });
});

describe('pcmToWav', () => {
  it('TC-A2: produces valid WAV header (44 bytes + data)', () => {
    const pcm = Buffer.alloc(100);
    const wav = pcmToWav(pcm);
    expect(wav.length).toBe(44 + 100);

    expect(wav.toString('utf-8', 0, 4)).toBe('RIFF');
    expect(wav.toString('utf-8', 8, 12)).toBe('WAVE');
    expect(wav.toString('utf-8', 12, 16)).toBe('fmt ');
    expect(wav.toString('utf-8', 36, 40)).toBe('data');

    expect(wav.readUInt32LE(4)).toBe(44 + 100 - 8);
    expect(wav.readUInt16LE(20)).toBe(1); // PCM
    expect(wav.readUInt16LE(22)).toBe(2); // stereo
    expect(wav.readUInt32LE(24)).toBe(48000);
    expect(wav.readUInt32LE(40)).toBe(100);
  });
});
