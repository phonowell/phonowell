# Product Model

## One-Well Rule

A `well` is a project container with exactly one final artifact target.
No multi-artifact target in one well.

## Canonical Asset Rule

Use a low-coupling canonical asset set as active source of truth.
Fine-grained assets are archived under `legacy` for traceability.

## Active Canonical Drops

- `drop-canon-core-foundation`
- `drop-canon-acceptance-contract`
- `drop-canon-execution-protocol`
- `drop-canon-v1-delivery`
- `drop-ref-mimikit-openai-llm`
- `drop-ref-react-19`
- `drop-ref-codex`
- `drop-ref-visualization-first`
- `drop-ref-engineering-execution`

## Entities

### Well

Required fields:

- `well-id`: unique ID with prefix (`well-`)
- `artifact-type`: target output type (`app | ppt | video | game | ...`)
- `origin-drop-id`: one required `drop-goal-origin-*`
- `acceptance-drop-id`: one required `drop-canon-acceptance-contract`
- `acceptance-status`: `pending | accepted`
- `accepted-candidate-id`: latest explicitly accepted candidate when present
- `accepted-at`: timestamp for the latest explicit acceptance decision
- `wish`: concise artifact specification
- `definition-of-done`: completion criteria
- `constraints`: time/tech/style/license boundaries
- `dry-run-status`: `pass | warn | fail` (latest pre-generation gate result)
- `dry-run-report`: quantified gate report (`check-total`, `pass-count`, `warn-count`, `fail-count`, `critical-warn-count`, `critical-fail-count`, `high-conflict-count`, `missing-required-capability-count`, `asset-unclear-count`, `asset-missing-purpose-count`, `asset-orphan-count`, `design-overlap-count`, `design-contradiction-count`, `design-redundancy-count`, `design-error-count`, `design-low-roi-count`, `gate-reason`)
- `status`: lifecycle stage

### Drop (Asset)

Required fields:

- `drop-id`: unique ID with prefix (`drop-`)
- `well-id`: parent well reference
- `type`: `goal-origin | canonical-bundle | reference-tech | reference-project | image | doc | url | note | generated | ...`
- `domain`: `core | protocol | delivery | reference | legacy`
- `scope`: `well-global | well-local | run-local`
- `source`: where it came from
- `summary`: structured summary
- `priority`: `p0 | p1 | p2` (default `p1`)
- `confidence`: analysis confidence
- `license-state`: known/unknown/restricted
- `created-at`
- `updated-at`

Optional fields:

- `parent-drop-id`: required when `scope=run-local`; points to the parent decision asset
- `lifecycle-state`: `candidate | promoted | archived` for micro asset progression
- `tags`: for search/filter/UI display only; never used as governance or execution decision input

### Verify Cycle Decision Record

Required fields:

- `cycle-id`: unique ID with prefix (`cycle-`)
- `well-id`: parent well reference
- `verify-route`: `gap-check | analyze | regenerate`
- `verify-route-evidence`: linked checks or deltas
- `priority-changes`: list of `{drop-id, from, to, reason}`
- `override-needed`: `true | false`

Optional fields:

- `override-type`: `verify-routing | priority-lifecycle`
- `override-reason`: trigger detail
- `override-decision`: `accept-ai | user-override`
- `override-decision-note`: user-entered rationale

## Granularity Metric

- blast radius: number of assets touched by one requirement update

## Guardrails

- No generation before goal-origin is confirmed.
- No verify pass before acceptance contract is explicitly bound and checkable.
- Incoming assets should be ingested and visible immediately; deeper analysis must not block ingest.
- Before generation, dry-run must confirm every active asset has clear content/purpose/relation mapping.
- Before generation, dry-run must report design health across overlap/contradiction/redundancy/error/low-ROI axes.
- First-principles modeling is required before generation.
- Conflicts are visible after commit and checked before run.
- Persistent high blast radius triggers asset repartition.
- Core decisions must rely on `domain + scope`, not `tags`.
- Low cognitive load is default: user action count should be minimized.
- verify routing is executed by default and recorded with route execution evidence.
- priority lifecycle recommendations now write back state when confidence is acceptable; deferred updates are recorded as override-required audits.
- override trigger hit records audit evidence and does not block editing.
- micro assets must follow candidate -> promoted -> archived lifecycle managed by AI by default.
- generation requires explicit dry-run and reverse validation record.
- generation defaults to minimal output and reuse-first asset selection.

## Public Product Surface

- default user action set:
- add material
- confirm or revise goal
- continue loop or review requested checkpoint
- accept final artifact direction
- manual relation editing remains available because incorrect structure can be expensive to recover from silently
- manual summary editing remains available because user-authored correction is sometimes cheaper than iterative prompting
- raw packet/proposal/verify evidence remains diagnostics-only by default because trust requires inspectability without forcing every user through internals
- stage-specific actions are not the primary UX contract; they are fallback and diagnostics controls
