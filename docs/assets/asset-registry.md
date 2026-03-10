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

3. `drop-canon-legacy-archive-boundary`
- scope: `well-global`
- file: `docs/assets/canonical/legacy-archive-boundary.md`
- role: legacy is archive-only and excluded from active runtime execution

4. `drop-canon-asset-layering-contract`
- scope: `well-global`
- file: `docs/assets/canonical/asset-layering-contract.md`
- role: explicit contract/policy/reference layering for active assets

### Domain: `protocol`

1. `drop-canon-execution-protocol`
- scope: `well-global`
- file: `docs/assets/canonical/execution-protocol.md`
- role: chat-to-asset execution protocol, explicit dry-run gate, reverse validation, asset clarity and design health checks, worktree parallel strategy, low cognitive load defaults, and micro asset lifecycle rules

2. `drop-canon-data-format-contract`
- scope: `well-global`
- file: `docs/assets/canonical/data-format-contract.md`
- role: standard phonowell data model, diff, and persistence contract

3. `drop-canon-state-versioning-contract`
- scope: `well-global`
- file: `docs/assets/canonical/state-versioning-contract.md`
- role: schema version and state migration contract

4. `drop-canon-entity-schema-contract`
- scope: `well-global`
- file: `docs/assets/canonical/entity-schema-contract.md`
- role: explicit entity-level schema contract for drop/relation/candidate/packet/verify

5. `drop-canon-relation-semantics-contract`
- scope: `well-global`
- file: `docs/assets/canonical/relation-semantics-contract.md`
- role: stable relation vocabulary across runtime, diff, and UI

6. `drop-canon-workdir-contract`
- scope: `well-global`
- file: `docs/assets/canonical/workdir-contract.md`
- role: `.phonowell` workdir root contract

7. `drop-canon-generator-diff-contract`
- scope: `well-global`
- file: `docs/assets/canonical/generator-diff-contract.md`
- role: generator must consume asset-management diffs instead of full blind regeneration

### Domain: `delivery`

1. `drop-canon-v1-delivery`
- scope: `well-global`
- file: `docs/assets/canonical/v1-delivery.md`
- role: V1 scope, UX semantics, runtime alignment, and milestone target

2. `drop-canon-project-layer`
- scope: `well-global`
- file: `docs/assets/canonical/project-layer.md`
- role: project layer above well with create/switch/delete behavior

3. `drop-canon-ui-observability-contract`
- scope: `well-global`
- file: `docs/assets/canonical/ui-observability-contract.md`
- role: schema/version/gate/diff visibility in WebUI

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
- role: archived-only historical assets; not part of the active catalog

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

8. `rel-format-constrains-versioning`
- from: `drop-canon-data-format-contract`
- to: `drop-canon-state-versioning-contract`
- relation-type: `constrains`

9. `rel-format-derives-entity-schema`
- from: `drop-canon-data-format-contract`
- to: `drop-canon-entity-schema-contract`
- relation-type: `derives`

10. `rel-versioning-constrains-workdir`
- from: `drop-canon-state-versioning-contract`
- to: `drop-canon-workdir-contract`
- relation-type: `constrains`

11. `rel-project-implements-workdir`
- from: `drop-canon-project-layer`
- to: `drop-canon-workdir-contract`
- relation-type: `implements`

12. `rel-generator-diff-constrains-v1`
- from: `drop-canon-generator-diff-contract`
- to: `drop-canon-v1-delivery`
- relation-type: `constrains`

13. `rel-layering-constrains-observability`
- from: `drop-canon-asset-layering-contract`
- to: `drop-canon-ui-observability-contract`
- relation-type: `constrains`

14. `rel-relation-semantics-constrains-observability`
- from: `drop-canon-relation-semantics-contract`
- to: `drop-canon-ui-observability-contract`
- relation-type: `constrains`

15. `rel-ui-observability-implements-v1`
- from: `drop-canon-ui-observability-contract`
- to: `drop-canon-v1-delivery`
- relation-type: `implements`

16. `rel-ref-mimikit-informs-v1`
- from: `drop-ref-mimikit-openai-llm`
- to: `drop-canon-v1-delivery`
- relation-type: `references`

17. `rel-ref-react19-informs-v1`
- from: `drop-ref-react-19`
- to: `drop-canon-v1-delivery`
- relation-type: `references`

18. `rel-ref-codex-informs-protocol`
- from: `drop-ref-codex`
- to: `drop-canon-execution-protocol`
- relation-type: `references`

19. `rel-ref-codex-informs-v1`
- from: `drop-ref-codex`
- to: `drop-canon-v1-delivery`
- relation-type: `references`

20. `rel-ref-visualization-informs-v1`
- from: `drop-ref-visualization-first`
- to: `drop-canon-v1-delivery`
- relation-type: `references`

21. `rel-ref-engineering-execution-informs-protocol`
- from: `drop-ref-engineering-execution`
- to: `drop-canon-execution-protocol`
- relation-type: `references`

22. `rel-ref-engineering-execution-informs-v1`
- from: `drop-ref-engineering-execution`
- to: `drop-canon-v1-delivery`
- relation-type: `references`

## Usage Rule

Decisions should prefer canonical assets.
Legacy assets are consulted only when canonical context is insufficient.
Execution order should prioritize `p0` before `p1` and `p2`.
