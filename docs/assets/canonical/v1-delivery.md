---
dropId: drop-canon-v1-delivery
type: canonical-bundle
domain: delivery
scope: well-global
owner: delivery-core
layer: contract
priority: p0
title: Canonical V1 Delivery Asset
active: true
---
# Canonical V1 Delivery Asset

## Purpose

Single source of truth for V1 scope, UX, event semantics, runtime contract, and milestone.

## V1 Target

- artifact: `phonowell WebUI V1`
- mode: minimal canvas interaction
- user actions: `drop` + `connect`

## V1 Experience

1. center node is `goal-origin`
2. assets ingest immediately and queue background automation with auditable decisions
3. system may auto-apply only high-confidence summary/metadata/relation updates; low-confidence results stay as recorded candidates
4. summary cards support manual edit
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
