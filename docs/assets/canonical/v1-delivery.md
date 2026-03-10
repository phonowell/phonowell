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
- mode: low-UI assistant workspace with progressive disclosure
- default user actions:
- add material
- confirm or revise goal
- continue loop or review requested checkpoint
- accept final artifact direction

## V1 Experience

1. user drops material and sees one current artifact/result view plus the next required action
2. AI owns organize, preflight, generate, and verify sequencing by default
3. high-confidence structure maintenance may auto-apply with recorded source, confidence, and rationale
4. ambiguous or high-impact changes become explicit review checkpoints
5. diagnostics expose packets, proposals, verify evidence, and manual controls without becoming the default surface

## V1 Execution Contract

- public runtime path is one resumable assistant loop that advances until `blocked | complete | failed`
- explicit user acceptance of the current direction is recorded separately from loop completion
- event-state model includes intent hypothesis, auditable loop status, and preflight check
- runtime packets cover analyze/gap-fill/generate/verify
- generation requires confirmed goal-origin
- read routes stay read-only; write routes still validate input, make one engine call, persist, and return
- delivery implementation should prefer mature reusable libraries and patterns before any custom from-scratch modules

## Default vs Diagnostics

- default surface keeps one primary CTA: continue the assistant loop
- manual `connect` and summary editing remain available for correction when AI structure inference is wrong
- manual `organize`, `preflight`, `generate`, and `verify` remain diagnostics/fallback controls for trust, recovery, and debugging
- packet/proposal/raw verify details remain available behind diagnostics because auditability is part of the trust surface

## V1 Delivery Window

- 2-week sprint
- worktree parallel mode for independent implementation slices
- exit criteria: end-to-end demo + DoD pass + visible failure paths
