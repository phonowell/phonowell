# Canonical V1 Delivery Asset

## Asset Metadata

- `drop-id`: `drop-canon-v1-delivery`
- `type`: `canonical-bundle`
- `domain`: `delivery`
- `scope`: `well-global`
- `owner`: `delivery-core`
- `priority`: `p0`

## Purpose

Single source of truth for V1 scope, UX, event semantics, runtime contract, and milestone.

## V1 Target

- artifact: `phonowell WebUI V1`
- mode: minimal canvas interaction
- user actions: `drop` + `connect`

## V1 Experience

1. center node is `goal-origin`
2. AI auto-analyzes and summarizes assets
3. AI auto-organizes graph in mindmap style
4. summary cards support manual edit and AI refine
5. conflicts are annotated, not hard-blocked by default

## V1 Execution Contract

- event-state model includes intent hypothesis and preflight check
- runtime packets cover analyze/gap-fill/generate/verify
- generation requires confirmed goal-origin
- delivery implementation should prefer mature reusable libraries and patterns before any custom from-scratch modules

## V1 Delivery Window

- 2-week sprint
- worktree parallel mode for independent implementation slices
- exit criteria: end-to-end demo + DoD pass + visible failure paths
