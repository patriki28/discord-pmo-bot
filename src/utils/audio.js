/**
 * PCM buffering and WAV conversion utilities.
 * All audio is 48kHz, 16-bit, stereo (Discord's default).
 */

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BIT_DEPTH = 16;
const BYTES_PER_SAMPLE = BIT_DEPTH / 8;

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

export function pcmDurationMs(pcmBuffer, channels = CHANNELS) {
  const bytesPerFrame = channels * BYTES_PER_SAMPLE;
  if (!pcmBuffer || pcmBuffer.length === 0 || bytesPerFrame <= 0) return 0;
  const totalFrames = pcmBuffer.length / bytesPerFrame;
  return Math.round((totalFrames / SAMPLE_RATE) * 1000);
}

export function downmixStereoToMono(pcmBuffer) {
  if (!pcmBuffer || pcmBuffer.length < 4) return pcmBuffer;

  const samples = pcmBuffer.length / 2;
  const mono = Buffer.alloc(Math.floor(samples / 2) * 2);
  let outOffset = 0;

  // 16-bit signed little-endian stereo interleaved [L][R]
  for (let i = 0; i + 3 < pcmBuffer.length; i += 4) {
    const left = pcmBuffer.readInt16LE(i);
    const right = pcmBuffer.readInt16LE(i + 2);
    const mixed = Math.max(-32768, Math.min(32767, Math.round((left + right) / 2)));
    mono.writeInt16LE(mixed, outOffset);
    outOffset += 2;
  }

  return mono;
}

export function normalizePcm16(pcmBuffer, targetPeak = 0.9) {
  if (!pcmBuffer || pcmBuffer.length < 2) return pcmBuffer;

  let peak = 0;
  for (let i = 0; i + 1 < pcmBuffer.length; i += 2) {
    const v = Math.abs(pcmBuffer.readInt16LE(i));
    if (v > peak) peak = v;
  }
  if (peak === 0) return pcmBuffer;

  const desiredPeak = Math.floor(32767 * targetPeak);
  const gain = desiredPeak / peak;
  if (gain <= 1.01) return pcmBuffer;

  const normalized = Buffer.alloc(pcmBuffer.length);
  for (let i = 0; i + 1 < pcmBuffer.length; i += 2) {
    const v = pcmBuffer.readInt16LE(i);
    const amplified = Math.max(-32768, Math.min(32767, Math.round(v * gain)));
    normalized.writeInt16LE(amplified, i);
  }
  return normalized;
}
