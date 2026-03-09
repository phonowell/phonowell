# phonowell

Drop everything in. Make a wish. Let it resonate into one artifact.

## Brand Promise

You make a wish. We make it real.

## What It Is

`phonowell` is an asset-first AI orchestration project.
A project is a single well. You drop fragmented resources into it, define one wish, and AI helps converge toward one final artifact.

## Canonical Asset Set

To keep granularity healthy and blast radius low, active assets are partitioned by `domain + scope`:

1. [Core Foundation](./docs/assets/canonical/core-foundation.md)
2. [Acceptance Contract](./docs/assets/canonical/acceptance-contract.md)
3. [Execution Protocol](./docs/assets/canonical/execution-protocol.md)
4. [V1 Delivery](./docs/assets/canonical/v1-delivery.md)

Reference assets:

- [Mimikit Reference](./docs/assets/references/mimikit-reference.md)
- [React 19 Reference](./docs/assets/references/react-19-reference.md)
- [Codex Reference](./docs/assets/references/codex-reference.md)
- [Visualization-First Reference](./docs/assets/references/visualization-reference.md)
- [Engineering Execution Reference](./docs/assets/references/engineering-execution-reference.md)

Registry:

- [Asset Registry](./docs/assets/asset-registry.md)

Legacy fine-grained assets are archived under:

- [Legacy Asset Set](./docs/assets/legacy/README.md)

## Model Rule

- `domain + scope` are governance fields and must be explicit
- `priority` (`p0|p1|p2`) marks importance and execution order
- `tags` are optional for search/display only, not governance input

## Micro Asset Rule

- small generated assets default to `run-local` + `p2`
- AI handles candidate/promote/archive lifecycle by default
- only promoted assets enter persistent active graph

## Human-Centered Principle

- default to low cognitive load
- humans are not suited for managing complex projects directly
- AI should absorb complexity and keep user actions minimal
- preserving user flow continuity is mandatory; drop/edit/connect should stay non-blocking

## Delivery Default

- generate minimal viable artifacts by default
- prefer mature existing assets/libraries/tools before from-scratch builds
- use reuse-first to reduce uncertainty
- prioritize visual expression for structure/status communication
- engineering execution baseline: TypeScript + tsx direct run + code-first uncertainty reduction + no-question-in-generate

## High-Level Flow

1. Confirm goal-origin.
2. Capture intent and ingest assets immediately (visible first, non-blocking).
3. Model by first principles, then annotate conflicts and refine minimal asset set.
4. Assign priority and execute `p0 -> p1 -> p2` with reuse-first selection.
5. Run explicit dry-run preflight (`pass|warn|fail`).
 - quantified rule (V1): `fail-count>=1 => fail`; no fail + critical warnings or >=2 warnings => `warn`; otherwise `pass`
 - must have explicit acceptance contract with checkable acceptance items
 - must close all unresolved user-facing questions before generate
 - must confirm all active assets have clear content/purpose/relation mapping
 - must detect overlap/contradiction/redundancy/error/low-ROI design issues
6. Run reverse validation with sharp questions and boundary cases.
7. Generate and verify one artifact.
 - generate stage is execution-only and should not ask user questions
 - verify pass requires acceptance coverage evidence linked to acceptance contract asset
 - for phonowell itself, acceptance includes self-iteration/self-management evidence
8. AI routes retry path and priority updates by default.
 - trigger hit (`route loop`, `stage bypass`, `unsupported priority flip`, `evidence missing`) => must request user override decision

## Scope Boundary

`phonowell` is an orchestration layer, not an execution runtime.
Execution should be delegated to external runtimes/tools.
