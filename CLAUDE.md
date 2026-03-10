# phonowell

## Key Constraints
- Keep boundary promises honest. If README/API says an endpoint is read-only/transient, it must not mutate unrelated persisted state.
- Prefer explicit flows over hidden automation. Boot, conversation, organize, generate, verify, and debug paths must stay behaviorally distinct.
- Reduce change radius, not just file length. Splits are only good when one behavior change touches fewer modules.
- Treat `engine` as coordinator, not the place where state edits, changed-id tracking, and logging are reimplemented.
- New abstractions must remove duplicated orchestration logic; do not create wrapper layers that only forward calls.

## Current Architecture
- Runtime core: `src/orchestrator`
- HTTP API: `src/server/api`
- Static UI: `webui`
- Tests: `src/test`
- Schemas: `schemas`

## Commands
- Install: `pnpm install`
- Dev: `pnpm run dev`
- Test: `pnpm test`
- Build: `pnpm build`
- Dry run: `pnpm run dry-run`
- Coverage: `pnpm run coverage`
- Core gate: `pnpm run core-gate`

## Workflow
- Before editing, identify whether the change is a state edit, orchestration flow, packet/runtime concern, schema concern, or API concern.
- For behavioral changes, update tests first or in the same patch.
- After changes, run `pnpm test` and `pnpm build` unless blocked.
- Use `plans/task_plan_{suffix}.md` for non-trivial work that spans multiple modules.

## Design Rules
- State mutation policy:
- Route handlers should validate input, call one engine/use-case method, persist when appropriate, and return.
- Read-only or transient paths must not mutate packets, proposals, unresolved questions, run logs, or graph state unless explicitly documented.
- Debug-only capabilities must remain gated behind `PHONOWELL_ENABLE_DEBUG_API=1`.

- Action/use-case policy:
- Prefer action results or equivalent patterns that bundle value + changed ids + logs.
- If a state-changing operation still requires follow-up work in `engine`, ask whether the abstraction is incomplete.
- Avoid scattering `markChanged`, run-log creation, and proposal lifecycle logic across multiple layers.

- Packet/runtime policy:
- Keep prompt building, schema definition, execution, structured post-processing, and record creation separate.
- Fallback behavior must stay explicit and surfaced as provenance, never disguised as model output.

- Schema/validation policy:
- Keep input validation separate from state/schema normalization.
- Migrations, schema loading, and runtime input validation should live in different modules unless coupling is unavoidable.

- Maintainability policy:
- Prefer deleting or collapsing weak abstractions over adding more adapters.
- A new file should own a stable reason to change.
- If a behavior requires edits in `engine` plus several helper modules, keep pushing until the seam is clearer.

## Anti-Patterns Seen Here
- Moving logic into new files without reducing the number of places needed to understand one behavior.
- Making a path look transient while still mutating adjacent persisted state.
- Hiding complexity behind grand naming instead of narrowing responsibility.
- Reintroducing debug or low-level runtime controls into the default user path.

## Output Expectations
- Be concise and factual.
- Explain why a boundary exists when changing it.
- When refactoring, state whether the change reduced modification points for the targeted behavior.
