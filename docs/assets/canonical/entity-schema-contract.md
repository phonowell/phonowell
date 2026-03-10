---
dropId: drop-canon-entity-schema-contract
type: canonical-bundle
domain: protocol
scope: well-global
owner: orchestrator-core
layer: contract
priority: p0
title: Canonical Entity Schema Contract Asset
active: true
---
# Canonical Entity Schema Contract Asset

## Purpose

Single source of truth for explicit schemas of phonowell entities instead of validating only the top-level container.

## Contract

1. core entity schemas are explicit:
- `drop`
- `relation`
- `candidate-artifact`
- `packet-record`
- `verify-report`

2. top-level state schema composes entity schemas
3. runtime validation must reject malformed entity records even if top-level state shape exists

## Guardrails

- no top-level-only schema gate
- no untyped entity payload hidden inside valid-looking state
