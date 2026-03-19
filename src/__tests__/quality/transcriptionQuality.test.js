import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scan } from '../../services/taskDetector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/transcription-fixtures.json'), 'utf-8')
);

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wer(reference, hypothesis) {
  const r = normalize(reference).split(' ').filter(Boolean);
  const h = normalize(hypothesis).split(' ').filter(Boolean);
  const dp = Array.from({ length: r.length + 1 }, () => Array(h.length + 1).fill(0));
  for (let i = 0; i <= r.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= h.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= r.length; i += 1) {
    for (let j = 1; j <= h.length; j += 1) {
      const cost = r[i - 1] === h[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return r.length === 0 ? 0 : dp[r.length][h.length] / r.length;
}

describe('transcription quality fixtures', () => {
  it('keeps fixture WER under configured gate', () => {
    const errors = fixtures.map((f) => wer(f.reference, f.hypothesis));
    const avgWer = errors.reduce((sum, e) => sum + e, 0) / errors.length;
    expect(avgWer).toBeLessThanOrEqual(0.2);
  });

  it('detects action items in curated fixture lines', () => {
    const guild = { members: { cache: { find: () => null } } };
    const candidates = fixtures
      .filter((f) => f.expectTask)
      .flatMap((f) => scan(f.hypothesis, guild));
    expect(candidates.length).toBeGreaterThan(0);
  });
});
