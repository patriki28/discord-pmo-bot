/**
 * PCM buffering and WAV conversion utilities.
 * All audio is 48kHz, 16-bit, stereo (Discord's default).
 */

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BIT_DEPTH = 16;

export class UserAudioBuffer {
  constructor(userId, username) {
    this.userId = userId;
    this.username = username;
    this.chunks = [];
  }

  push(pcmData) {
    this.chunks.push(Buffer.from(pcmData));
  }

  flush() {
    if (this.chunks.length === 0) return null;
    const pcm = Buffer.concat(this.chunks);
    this.chunks = [];
    return pcm;
  }

  get hasData() {
    return this.chunks.length > 0;
  }
}

export function pcmToWav(pcmBuffer) {
  const byteRate = SAMPLE_RATE * CHANNELS * (BIT_DEPTH / 8);
  const blockAlign = CHANNELS * (BIT_DEPTH / 8);
  const dataSize = pcmBuffer.length;
  const headerSize = 44;

  const header = Buffer.alloc(headerSize);

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(dataSize + headerSize - 8, 4);
  header.write('WAVE', 8);

  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);           // chunk size
  header.writeUInt16LE(1, 20);            // PCM format
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BIT_DEPTH, 34);

  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}
