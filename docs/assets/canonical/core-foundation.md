# Canonical Core Foundation Asset

## Asset Metadata

- `drop-id`: `drop-canon-core-foundation`
- `type`: `canonical-bundle`
- `domain`: `core`
- `scope`: `well-global`
- `owner`: `product-core`
- `priority`: `p0`

## Purpose

Single source of truth for product identity and reasoning constraints.
This bundle replaces multiple fragmented principle assets.

## Included Foundations

1. Brand Story
- `phonowell`: drop assets in, make one wish, get one artifact
- promise: `You make a wish. We make it real.`

2. Product Philosophy
- assets are first-class
- explicit structure over hidden context
- one project serves one artifact

3. Goal-Origin Rule
- each well has exactly one `goal-origin` asset
- AI drafts it, user can edit and confirm

4. First-Principles Rule
- user wording is signal, not always final intent
- intent hypotheses stay explicit until convergence

5. Granularity Rule
- keep blast radius low
- repeated high blast radius triggers asset partition refactor

6. Low Cognitive Load Rule
- humans are not good at managing high project complexity directly
- system should absorb complexity and keep user interaction minimal
- user flow continuity is mandatory: ingest and basic editing must stay smooth and non-blocking

7. Minimal + Reuse-First Rule
- generated artifacts should be minimal by default
- prefer mature existing assets/libraries/tools before custom from-scratch implementation
- reduce uncertainty by maximizing proven components

8. Acceptance-First Rule
- artifact acceptance conditions are first-class assets
- acceptance contract must be explicit before verify can pass

## Core Guardrails

- no hidden decisions outside asset graph
- no generation before confirmed goal-origin
- no verify pass without explicit acceptance contract coverage
- no persistent high-coupling asset structure
- no unnecessary user-facing complexity
- no workflow step should block normal drop/edit/connect actions unless generation safety requires it
- no default from-scratch implementation when mature alternatives exist
