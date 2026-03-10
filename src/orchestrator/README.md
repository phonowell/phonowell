# Orchestrator

`src/orchestrator` now provides an executable orchestration core for `phonowell`.

## Implemented

- typed well/drop/relation model
- state machine-aligned status flow
- goal-origin draft/edit/confirm
- immediate ingest with auto-attach relations
- explicit dry-run (9 checks + quantified gate)
- generate and verify loop with evidence
- explicit packet runtime for `analyze/gap-fill/generate/verify`
- structured packet output (`summary/artifactContent/issues/suggestions/assetPatches/relationPatches`)
- codex-sdk runtime execution with local `~/.codex` settings
- AI-owned micro asset lifecycle (candidate/promoted/archived)
- coverage audit against all documented assets
- project-scoped state persistence under `.phonowell/projects/<slug>/state.json`
- diff-driven incremental candidate generation

## Files

- `types.ts`: domain contracts
- `asset-catalog.ts`: parses docs assets into runtime catalog
- `engine.ts`: orchestration logic and loops
- `packet-runtime.ts`: explicit runtime packet execution and evidence capture
- `provider.ts`: provider settings resolution
- `coverage.ts`: asset implementation coverage report
- `store.ts`: state load/persist helpers
