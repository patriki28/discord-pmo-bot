# Transcription Accuracy Enhancement Plan

## Objective
Improve `/transcribe` quality and reliability with local-first operation.

## Scope
- Add profile-based transcription controls (`accuracy`, `balanced`, `fast`)
- Improve segmentation behavior and context carryover
- Add lightweight audio conditioning
- Harden retries, queueing, and timeout handling
- Add regression-oriented QA fixtures and CI quality gates

## Acceptance Targets
- Transcript latency: P50 <= 4s, P95 <= 10s
- Fixture WER: <= 20% overall, <= 15% clean subset
- Dropped utterances above minimum duration: < 3%
- Task extraction quality: precision >= 0.85, recall >= 0.75
- Whisper invocation failure rate: < 1% (excluding explicit config errors)

## Team Responsibilities
1. PM: release objective and thresholds
2. PO: prioritize implementation stories
3. Business: map quality gains to user outcomes
4. Architect: validate NFR tradeoffs (latency/CPU/privacy)
5. Design Authority: transcript quality messaging conventions
6. QA Lead: define matrix and measurable gates first
7. Dev Teams: implement phased pipeline upgrades
8. DevOps: quality gates and reproducibility checks
9. SM: enforce DoD and remove blockers
10. Orchestrator: release-readiness package

## Phase A: Quick Wins
- Configurable transcription profile and language
- Configurable segmentation thresholds
- Better timeout/drop/failure telemetry

## Phase B: Pipeline Hardening
- Prompt context carryover between adjacent utterances
- Mono downmix + normalization preprocessing
- Bounded queue with retry/backoff behavior

## Phase C: Observability and Validation
- Structured telemetry fields
- Fixture regression checks
- Task extraction rule calibration against improved transcripts
