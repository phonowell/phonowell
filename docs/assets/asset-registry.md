# Asset Registry

## Active Canonical Assets

### Domain: `core`

1. `drop-canon-core-foundation`
- scope: `well-global`
- file: `docs/assets/canonical/core-foundation.md`
- role: brand + philosophy + goal-origin + first-principles + granularity + low cognitive load + flow continuity + minimal/reuse-first baseline

2. `drop-canon-acceptance-contract`
- scope: `well-global`
- file: `docs/assets/canonical/acceptance-contract.md`
- role: single source of truth for artifact acceptance conditions and verify pass criteria

### Domain: `protocol`

1. `drop-canon-execution-protocol`
- scope: `well-global`
- file: `docs/assets/canonical/execution-protocol.md`
- role: chat-to-asset execution protocol, explicit dry-run gate, reverse validation, asset clarity and design health checks, worktree parallel strategy, low cognitive load defaults, and micro asset lifecycle rules

### Domain: `delivery`

1. `drop-canon-v1-delivery`
- scope: `well-global`
- file: `docs/assets/canonical/v1-delivery.md`
- role: V1 scope, UX semantics, runtime alignment, and milestone target

### Domain: `reference`

1. `drop-ref-mimikit-openai-llm`
- scope: `well-global`
- file: `docs/assets/references/mimikit-reference.md`
- role: reference for OpenAI provider and selected LLM interaction patterns

2. `drop-ref-react-19`
- scope: `well-global`
- file: `docs/assets/references/react-19-reference.md`
- role: reference baseline for WebUI implementation stack

3. `drop-ref-codex`
- scope: `well-global`
- file: `docs/assets/references/codex-reference.md`
- role: reference for AI-assisted execution and verify feedback loops

4. `drop-ref-visualization-first`
- scope: `well-global`
- file: `docs/assets/references/visualization-reference.md`
- role: reference principle for visual-first expression of asset structure and project status

5. `drop-ref-engineering-execution`
- scope: `well-global`
- file: `docs/assets/references/engineering-execution-reference.md`
- role: unified engineering execution reference (TypeScript + tsx + code-first + no-question-in-generate)

### Domain: `legacy`

- file: `docs/assets/legacy/`
- role: historical fine-grained assets kept for traceability; not active source of truth

## Minimal Relation Graph

1. `rel-core-constrains-protocol`
- from: `drop-canon-core-foundation`
- to: `drop-canon-execution-protocol`
- relation-type: `constrains`

2. `rel-core-constrains-acceptance`
- from: `drop-canon-core-foundation`
- to: `drop-canon-acceptance-contract`
- relation-type: `constrains`

3. `rel-acceptance-constrains-protocol`
- from: `drop-canon-acceptance-contract`
- to: `drop-canon-execution-protocol`
- relation-type: `constrains`

4. `rel-acceptance-constrains-v1`
- from: `drop-canon-acceptance-contract`
- to: `drop-canon-v1-delivery`
- relation-type: `constrains`

5. `rel-core-constrains-v1`
- from: `drop-canon-core-foundation`
- to: `drop-canon-v1-delivery`
- relation-type: `constrains`

6. `rel-protocol-drives-v1`
- from: `drop-canon-execution-protocol`
- to: `drop-canon-v1-delivery`
- relation-type: `supports`

7. `rel-protocol-constrains-workflow`
- from: `drop-canon-execution-protocol`
- to: `drop-canon-v1-delivery`
- relation-type: `constrains`

8. `rel-ref-mimikit-informs-v1`
- from: `drop-ref-mimikit-openai-llm`
- to: `drop-canon-v1-delivery`
- relation-type: `references`

9. `rel-ref-react19-informs-v1`
- from: `drop-ref-react-19`
- to: `drop-canon-v1-delivery`
- relation-type: `references`

10. `rel-ref-codex-informs-protocol`
- from: `drop-ref-codex`
- to: `drop-canon-execution-protocol`
- relation-type: `references`

11. `rel-ref-codex-informs-v1`
- from: `drop-ref-codex`
- to: `drop-canon-v1-delivery`
- relation-type: `references`

12. `rel-ref-visualization-informs-v1`
- from: `drop-ref-visualization-first`
- to: `drop-canon-v1-delivery`
- relation-type: `references`

13. `rel-ref-engineering-execution-informs-protocol`
- from: `drop-ref-engineering-execution`
- to: `drop-canon-execution-protocol`
- relation-type: `references`

14. `rel-ref-engineering-execution-informs-v1`
- from: `drop-ref-engineering-execution`
- to: `drop-canon-v1-delivery`
- relation-type: `references`

## Usage Rule

Decisions should prefer canonical assets.
Legacy assets are consulted only when canonical context is insufficient.
Execution order should prioritize `p0` before `p1` and `p2`.
