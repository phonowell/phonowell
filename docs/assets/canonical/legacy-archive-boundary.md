---
dropId: drop-canon-legacy-archive-boundary
type: canonical-bundle
domain: core
scope: well-global
owner: product-core
layer: contract
priority: p0
title: Canonical Legacy Archive Boundary Asset
active: true
---
# Canonical Legacy Archive Boundary Asset

## Purpose

Single source of truth that `legacy` assets are archive-only and must not participate in active runtime execution.

## Rules

1. `legacy` is archive-only
- legacy assets exist only for historical traceability
- legacy assets must not be loaded into active runtime state
- legacy assets must not be counted in active coverage or gate decisions

2. active-first runtime
- runtime catalog, orchestration state, and UI default views use active assets only
- any replayed persisted state must filter out legacy drops and legacy relations

## Guardrails

- no generation based on legacy assets
- no verify evidence sourced from legacy assets
- no UI default surface should show legacy assets as active choices
