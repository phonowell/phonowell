# No-Question-In-Generate Reference Asset

## Asset Metadata

- `drop-id`: `drop-ref-no-question-in-generate`
- `type`: `reference-protocol`
- `domain`: `reference`
- `scope`: `well-global`
- `owner`: `orchestrator-core`
- `priority`: `p0`

## Purpose

Reference protocol rule that generation stage must not ask users questions; all unresolved issues must be handled before generation in dry-run.

## Source

- principle: `产出产物阶段不应询问用户任何问题，所有问题应在 dry run 中都处理完`
- role: interaction boundary between dry-run and generate stages

## Intended Scope

1. block transition to generate when unresolved questions remain
2. force ambiguity/conflict resolution or explicit escalation in dry-run
3. keep generate stage execution-only for smooth user experience

## Non-Scope

- no interactive questioning during generate stage
- no implicit carry-over of unresolved decisions into generation
