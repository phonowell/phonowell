# Workflow

## State Machine

`goal-origin-init -> chat-intake -> ingest -> first-principles-modeling -> conflict-annotate -> analyze -> organize -> gap-check -> dry-run -> generate -> verify`

## Canonical Mapping

- behavior source: `drop-canon-execution-protocol`
- value constraints: `drop-canon-core-foundation`
- acceptance source: `drop-canon-acceptance-contract`
- delivery target: `drop-canon-v1-delivery`

## Default Public Journey

The default product journey is:

1. add material
2. confirm or revise goal
3. continue loop or review requested checkpoint
4. accept final artifact direction

The user does not manually run `organize`, `preflight`, `generate`, and `verify` as the primary path.
Those remain internal stages that the assistant loop may advance through on the user's behalf.

## Assistant Loop Contract

- public loop status: `idle | running | blocked | complete | failed`
- one loop run advances from current state until one user-meaningful checkpoint:
- `blocked`: user input, review, or correction is required
- `complete`: current artifact/result is ready for acceptance judgment or has already been explicitly accepted
- `failed`: execution failed and diagnostics should explain why
- organize, dry-run, generate, and verify stay explicit in audit records even when hidden from the default surface
- final user acceptance is a separate persisted decision, not just a loop status label

## Internal Stage Summary

1. Goal-Origin Init
- AI drafts goal-origin
- user confirms or edits

2. Chat Intake + Immediate Ingest
- capture raw intent
- commit drops immediately and show them in graph/UI
- this stage is non-blocking by default

3. First-Principles Modeling + Conflict Annotate
- build hypotheses and uncertainty flags
- refine committed drops toward minimal high-ROI set
- prefer mature reusable assets over from-scratch custom assets by default
- annotate conflicts without blocking by default
- place new small generated assets as `run-local` candidates by default

4. Analyze + Organize + Gap Check
- build graph understanding around goal-origin
- surface missing capabilities

5. Dry-Run (Explicit Preflight)
- run closure/completeness/conflict checks
- run acceptance check (contract bound + checkable items)
- run self-iteration check when acceptance includes self-management
- close all unresolved user-facing questions before generate transition
- run reverse validation with sharp questions and boundary cases
- run asset-clarity checks (`content`, `purpose`, `relation` completeness)
- run design-health checks (overlap/contradiction/redundancy/error/low-ROI)
- output gate status: `pass | warn | fail`
- apply quantified gate thresholds from `drop-canon-execution-protocol`

6. Generate + Verify
- run artifact generation
- generate stage must not ask user questions
- verify against DoD and constraints
- verify pass requires acceptance coverage against `drop-canon-acceptance-contract`
- when self-management is required, verify pass also requires self-iteration evidence packet
- AI routes next action on verify result

7. Override Checkpoint
- after each `verify`, system evaluates override triggers for:
- verify routing override
- priority lifecycle override
- when triggered, system records `override-needed` and requests explicit user decision before next cycle

## Low Cognitive Load Policy

- default workflow keeps user actions minimal
- complexity handling is delegated to AI and protocol automation
- advanced controls should be optional and progressive
- manual stage controls require justification tied to trust, safety, or correction cost

## Re-evaluation Trigger

Any drop/relation/goal/hypothesis change triggers partial re-evaluation.

## AI-Owned Control Loops

- verify fail routing is AI-owned by default
- priority promotion/demotion (`p0|p1|p2`) is AI-owned by default
- micro asset promotion/archive is AI-owned by default
- user can override both when needed
- override trigger evaluation is automatic; trigger hit means "must ask user", not "must resolve conflict"
