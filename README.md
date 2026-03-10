# phonowell

Drop everything in. Make a wish. Let it resonate into one artifact.

## What We Are Building

`phonowell` is a local workbench for turning scattered input into one deliverable artifact.
It manages active assets in `.phonowell`, mixes explicit runtime steps with bounded heuristics, and keeps generation incremental.

Default user-facing actions are:

- add material
- confirm or revise goal
- continue the assistant loop or review the requested checkpoint
- accept the current artifact direction

The default path is one public, resumable assistant loop.
It may internally run organize, preflight, generate, and verify, but those are not the primary user controls.

Manual controls remain available as diagnostics or fallback when trust, safety, or correction cost requires them:

- `connect`
- summary edit
- `organize`
- `preflight`
- `generate`
- `verify`

System automation remains explicit and auditable:

- `POST /api/deep-organize` runs packet-backed `analyze -> apply -> gap-fill -> apply`
- `POST /api/dry-run` runs the quantified preflight gate
- `POST /api/generate` produces an incremental candidate from the latest generation diff without mutating assets or relations
- `POST /api/verify` verifies acceptance coverage, records changed-drop -> acceptance-item -> evidence mapping, executes the selected next route, and audits priority lifecycle updates
- `POST /api/conversations` records the user message and writes back an analysis reply. It does not mutate the asset graph, unresolved questions, run logs, or packet/proposal state.
- `POST /api/drops` returns immediately, then queues post-ingest automation for summary/metadata/relation/conflict/preflight refresh with explicit heuristic/system-rule provenance and confidence-scoped decisions

## Run

```bash
pnpm install
pnpm run dev
```

Open `http://localhost:38888`.

## Commands

```bash
pnpm run build
pnpm run dry-run
pnpm run coverage
pnpm run core-gate
pnpm run core-gate:offline
pnpm run import:assets
```

## Core API

- `GET /api/state`
- `GET /api/loop`
- `GET /api/projects`
- `POST /api/projects`
- `PUT /api/projects/:slug`
- `DELETE /api/projects/:slug`
- `POST /api/drops`
- `POST /api/relations`
- `POST /api/goal/draft`
- `PUT /api/goal`
- `POST /api/acceptance-links`
- `POST /api/assistant-loop`
- `POST /api/assistant-loop/accept`
- `POST /api/deep-organize`
- `POST /api/dry-run`
- `POST /api/conversations`
- `POST /api/generate`
- `POST /api/verify`
- `GET /api/observability`

## Debug API

Enable with `PHONOWELL_ENABLE_DEBUG_API=1` when you need low-level runtime controls:

- `POST /api/auto-flow`
- `POST /api/cycle`
- `GET /api/packets`
- `POST /api/packets/:stage`
- `GET /api/proposals`
- `POST /api/proposals/:id/apply`
- `POST /api/proposals/:id/reject`
- `POST /api/import-assets`

## Runtime Notes

- workdir root is `.phonowell`
- active runtime is project-scoped: `.phonowell/projects/<slug>/state.json`
- append-only runtime log archive is project-scoped: `.phonowell/projects/<slug>/logs/run-events.jsonl`
- active assets only; legacy is archive-only
- default orchestration is resumable from persisted project state through `/api/assistant-loop`
- final acceptance judgment is recorded explicitly through `/api/assistant-loop/accept`
- packet runtime uses local Codex SDK auth/config from `~/.codex`
- `pnpm run core-gate` uses the normal runtime path
- `pnpm run core-gate:offline` is the stable fallback and forces `PHONOWELL_DISABLE_CODEX_RUNTIME=1`
- generate is diff-driven and defaults to incremental update when a prior candidate exists
- packet responses are stored as structured runtime records and always mark whether output came from `model` or `fallback`
- post-ingest automation records every applied/deferred decision in `automationTasks`, including `source`, `confidence`, and applied/deferred reason

## Canonical Asset Sources

- [Core Foundation](./docs/assets/canonical/core-foundation.md)
- [Acceptance Contract](./docs/assets/canonical/acceptance-contract.md)
- [Execution Protocol](./docs/assets/canonical/execution-protocol.md)
- [V1 Delivery](./docs/assets/canonical/v1-delivery.md)

This implementation now works against active assets only and treats runtime packets as first-class execution records.
