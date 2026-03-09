# Canonical Execution Protocol Asset

## Asset Metadata

- `drop-id`: `drop-canon-execution-protocol`
- `type`: `canonical-bundle`
- `domain`: `protocol`
- `scope`: `well-global`
- `owner`: `orchestrator-core`
- `priority`: `p0`

## Purpose

Single source of truth for how chat signals become executable asset graph state.

## Protocol

1. Chat Intake
- collect intent fragments, constraints, and references

2. Immediate Ingest (Non-Blocking)
- commit incoming drops immediately after intake
- ensure each new drop is visible in graph/UI before deeper analysis
- assign provisional metadata (`scope`, `domain`, `priority`) with AI defaults

3. First-Principles Modeling
- decompose objective/constraints/success/non-goals
- generate intent hypotheses and uncertainty flags

4. Minimal Commit
- commit only high-ROI assets
- merge redundant candidates
- assign `priority` (`p0|p1|p2`) with default `p1`
- prefer mature reusable assets before introducing custom build assets
- prefer deterministic code implementation to reduce uncertainty; delegate only LLM-only tasks to LLM

5. Conflict Annotation
- detect and annotate conflicts after commit
- do not block normal editing by default

6. Explicit Dry-Run Gate
- run a mandatory pre-generation dry run
- output gate result: `pass | warn | fail`
- if `fail`, generation is blocked until issues are re-routed and updated
- if `warn`, generation can continue with explicit visibility
- all unresolved user-facing questions must be closed in dry-run before entering generate

Dry-run quantified thresholds (V1):
- check set size: `9` (`closure`, `acceptance`, `self-iteration`, `completeness`, `conflict`, `reuse-first`, `reverse-validation`, `asset-clarity`, `design-health`)
- critical checks: `closure`, `completeness`, `conflict`
- per-check status: `pass | warn | fail`
- `pass`: `fail-count=0` and `critical-warn-count=0` and `warn-count<=1`
- `warn`: `fail-count=0` and (`critical-warn-count>=1` or `warn-count>=2`)
- `fail`: `fail-count>=1` or `critical-fail-count>=1` or `high-conflict-count>=1` or `missing-required-capability-count>=1`

Dry-run report minimum fields:
- `check-total`, `pass-count`, `warn-count`, `fail-count`
- `critical-warn-count`, `critical-fail-count`
- `high-conflict-count`, `missing-required-capability-count`
- `acceptance-unbound-count`, `acceptance-uncheckable-count`, `self-iteration-evidence-path-missing-count`
- `asset-unclear-count`, `asset-missing-purpose-count`, `asset-orphan-count`
- `design-overlap-count`, `design-contradiction-count`, `design-redundancy-count`, `design-error-count`, `design-low-roi-count`
- `gate-result`, `gate-reason`

Dry-run checklist:
- closure check: goal-origin -> required capabilities -> candidate execution path
- acceptance check: acceptance contract bound and each acceptance item is checkable
- self-iteration check: self-management acceptance evidence paths are defined and runnable
- completeness check: required assets and critical links present
- conflict check: unresolved contradictions and severity
- reuse-first check: mature alternatives evaluated before custom implementation
- reverse validation: adversarial questions + boundary cases + failure-mode probes
- asset-clarity check: all active assets have clear `content`, `purpose`, and at least one explicit relation path
- design-health check: detect overlap, contradiction, redundancy, obvious errors, and low-ROI design choices

Dry-run detail rules (V1):
- `asset-clarity pass`: `asset-unclear-count=0` and `asset-missing-purpose-count=0` and `asset-orphan-count=0`
- `asset-clarity warn`: no fail but at least one unclear field with AI confidence `<0.8`
- `asset-clarity fail`: any of `asset-unclear-count>=1`, `asset-missing-purpose-count>=1`, or `asset-orphan-count>=1`
- `design-health pass`: all `design-*` issue counts are `0`
- `design-health warn`: `design-low-roi-count>=1` and no contradiction/error
- `design-health fail`: any of `design-contradiction-count>=1` or `design-error-count>=1`

7. Graph-First Execution
- planning/gap-check/generation use committed graph as source of truth
- generate stage is execution-only and must not ask new user questions

8. AI Verify Routing
- AI decides the next step after verify: back to `gap-check`, `analyze`, or direct regenerate
- route decision must be evidence-backed and visible in run report
- verify pass requires acceptance coverage evidence linked to `drop-canon-acceptance-contract`
- verify pass requires at least one self-iteration evidence packet when self-management is in acceptance scope
- user override is triggered when any of the following is true:
- AI route bypasses a mandatory stage after `fail` (`gap-check` required before regenerate)
- same route repeats for `>=2` verify cycles with no reduction in `fail-count` or `warn-count`
- route conflicts with latest explicit user goal/constraint update
- route selects custom build while mature reusable option exists without evidence

9. AI Priority Lifecycle
- AI can raise/lower `priority` (`p0|p1|p2`) after each verify cycle
- updates are based on impact to goal-origin and current risk
- users can override AI-priority decisions
- user override is triggered when any of the following is true:
- AI promotes more than `2` drops to `p0` in one verify cycle
- AI demotes a drop that is upstream of unresolved `fail` items
- same drop changes priority back and forth within `2` consecutive cycles
- priority change has no evidence linked to goal impact or risk delta

10. Micro Asset Lifecycle
- new small generated assets default to `scope=run-local` and `priority=p2`
- each micro asset must attach to a parent decision via `parent-drop-id`
- AI promotes micro assets only when they block critical path, show cross-module reuse, or carry high verification risk
- non-promoted micro assets are compressed into candidate summaries and archived after milestone

## Low Cognitive Load Defaults

- default user actions stay minimal (`drop`, `connect`, `confirm`)
- AI handles summarization, organization, and most re-evaluation
- UI exposes only essential controls in default mode

## Parallel Delivery Strategy

Use worktree-based parallel development to speed up implementation.

- split independent tasks into separate worktrees
- keep canonical asset truth shared across worktrees
- merge completed slices back through quality review

## State Flow

`goal-origin-init -> chat-intake -> ingest -> first-principles-modeling -> conflict-annotate -> analyze -> organize -> gap-check -> dry-run -> generate -> verify`

## Quality Signals

- blast radius
- parallel throughput (completed slices per cycle)
- p0 coverage on critical path
