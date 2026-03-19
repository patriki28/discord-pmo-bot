# Transcription Quality Test Matrix

## Quality Gates
- `WER`: <= 20% overall fixture set, <= 15% clean subset
- `Latency`: P50 <= 4s, P95 <= 10s (utterance end to posted line)
- `Dropped utterances`: < 3% for valid utterances
- `Task detection`: precision >= 0.85, recall >= 0.75
- `Invocation failures`: < 1% excluding bad config

## Scenario Matrix
| Case | Area | Input | Expected |
|---|---|---|---|
| TQ-001 | Segmentation | Single speaker with short pauses | Full phrases, minimal truncation |
| TQ-002 | Segmentation | Long uninterrupted speech | No drops, bounded latency |
| TQ-003 | Noise | Background office noise | Usable transcript lines |
| TQ-004 | Reliability | Whisper timeout simulation | Retry path triggers, telemetry emitted |
| TQ-005 | Queueing | Multiple users speaking | Stable queue depth and no deadlock |
| TQ-006 | Task extraction | Explicit action-item statements | Correct candidate extraction |
| TQ-007 | Task extraction | Ambiguous/noisy statements | Reduced false positives |

## Fixture Policy
- Keep canonical transcript references for each fixture
- Store fixture metadata: speaker count, noise class, expected language
- Run on PRs that modify transcription, voice, or audio processing code

## CI Gate Rule
- Fail CI if any quality gate regresses past threshold
