import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execute } from '../../commands/transcribe.js';
import * as voice from '../../services/voice.js';

vi.mock('../../services/voice.js', () => ({
  getSession: vi.fn(),
  VoiceSession: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  })),
}));

function createInteraction(overrides = {}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const guild = {
    id: 'guild-123',
    members: {
      fetch: vi.fn().mockResolvedValue({
        voice: { channel: overrides.voiceChannel ?? null },
      }),
    },
  };
  return {
    options: { getSubcommand: () => overrides.subcommand ?? 'start' },
    guild,
    user: { id: 'user-1' },
    channel: { id: 'channel-1' },
    reply,
    ...overrides,
  };
}

describe('transcribe command', () => {
  beforeEach(() => {
    vi.mocked(voice.getSession).mockReset();
  });

  it('TC-T1: handleStart returns ephemeral error when user not in voice channel', async () => {
    const interaction = createInteraction({ subcommand: 'start', voiceChannel: null });
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'You need to be in a voice channel first.',
      ephemeral: true,
    });
    expect(voice.getSession).not.toHaveBeenCalled();
  });

  it('TC-T2: handleStart returns error when session already active', async () => {
    const voiceChannel = { id: 'vc-1' };
    const interaction = createInteraction({ subcommand: 'start', voiceChannel });
    vi.mocked(voice.getSession).mockReturnValue({}); // existing session

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'A transcription session is already active in this server.',
      ephemeral: true,
    });
  });

  it('TC-T3: handleStop returns error when no active session', async () => {
    const interaction = createInteraction({ subcommand: 'stop' });
    vi.mocked(voice.getSession).mockReturnValue(null);

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'No active transcription session.',
      ephemeral: true,
    });
  });

  it('TC-T4: handleStart calls VoiceSession.start() and replies correctly', async () => {
    const voiceChannel = { id: 'vc-1' };
    const interaction = createInteraction({ subcommand: 'start', voiceChannel });
    vi.mocked(voice.getSession).mockReturnValue(null);

    const mockStart = vi.fn().mockResolvedValue(undefined);
    vi.mocked(voice.VoiceSession).mockImplementation(() => ({ start: mockStart }));

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.stringContaining('Transcription starting.')
    );
    expect(voice.VoiceSession).toHaveBeenCalledWith(
      interaction.guild,
      voiceChannel,
      interaction.channel
    );
    expect(mockStart).toHaveBeenCalled();
  });

  it('TC-T5: handleStop calls session.stop() and replies correctly', async () => {
    const mockStop = vi.fn().mockResolvedValue(undefined);
    const interaction = createInteraction({ subcommand: 'stop' });
    vi.mocked(voice.getSession).mockReturnValue({ stop: mockStop });

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith('Stopping transcription...');
    expect(mockStop).toHaveBeenCalled();
  });
});
