---
dropId: drop-canon-relation-semantics-contract
type: canonical-bundle
domain: protocol
scope: well-global
owner: orchestrator-core
layer: contract
priority: p0
title: Canonical Relation Semantics Contract Asset
active: true
---
# Canonical Relation Semantics Contract Asset

## Purpose

Single source of truth for a tighter and more explicit relation vocabulary inside the phonowell asset graph.

## Contract

1. active relation semantics are constrained
- `constrains`
- `supports`
- `references`
- `derives`
- `implements`

2. relation meaning must stay stable across runtime, diff, gate, and UI
3. default auto-generated relations use the minimal valid semantic instead of a generic catch-all

## Guardrails

- no free-form relation labels in active runtime
- no semantic drift between graph storage and UI rendering
