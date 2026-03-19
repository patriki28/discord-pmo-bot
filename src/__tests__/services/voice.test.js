import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { buildMeetingMinutesMarkdown, getSession } from '../../services/voice.js';

vi.mock('../../config.js', () => ({
  config: {
    transcriptsDir: './transcripts',
    transcription: {
      silenceMs: 1000,
      minAudioMs: 180,
      maxSegmentMs: 15000,
      overlapMs: 350,
      normalizeAudio: true,
      downmixMono: true,
    },
  },
}));

describe('buildMeetingMinutesMarkdown', () => {
  const guild = { id: 'guild-123', name: 'Test Server' };
  const voiceChannel = { name: 'General' };
  const transcript = [
    { username: 'Alice', text: 'Welcome everyone', timestamp: '2026-03-19T14:30:00.000Z' },
    { username: 'Bob', text: 'I finished the API', timestamp: '2026-03-19T14:30:15.000Z' },
  ];

  it('TC-T6: produces correct meeting minutes format', () => {
    const startedAt = new Date('2026-03-19T14:00:00.000Z');
    const { filePath, content } = buildMeetingMinutesMarkdown(
      transcript,
      guild,
      voiceChannel,
      startedAt
    );

    expect(content).toContain('# Meeting Minutes');
    expect(content).toContain('**Server:** Test Server');
    expect(content).toContain('**Channel:** General');
    expect(content).toContain('**Date:**');
    expect(content).toContain('**Duration:**');
    expect(content).toContain('## Transcript');
    expect(content).toContain('**Alice:**');
    expect(content).toContain('Welcome everyone');
    expect(content).toContain('**Bob:**');
    expect(content).toContain('I finished the API');

    expect(filePath).toMatch(/transcript-guild-123-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.md$/);
    expect(filePath).toContain('transcripts');
  });

  it('uses "Unknown" when voiceChannel has no name', () => {
    const { content } = buildMeetingMinutesMarkdown(
      transcript,
      guild,
      { name: null },
      null
    );
    expect(content).toContain('**Channel:** Unknown');
  });

  it('uses "—" for duration when startedAt is null', () => {
    const { content } = buildMeetingMinutesMarkdown(
      transcript,
      guild,
      voiceChannel,
      null
    );
    expect(content).toContain('**Duration:** —');
  });
});

describe('getSession', () => {
  it('returns undefined when no session exists', () => {
    expect(getSession('nonexistent')).toBeUndefined();
  });
});
