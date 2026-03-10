---
dropId: drop-canon-state-versioning-contract
type: canonical-bundle
domain: protocol
scope: well-global
owner: orchestrator-core
layer: contract
priority: p0
title: Canonical State Versioning Contract Asset
active: true
---
# Canonical State Versioning Contract Asset

## Purpose

Single source of truth for versioning and migration of phonowell persisted state.

## Contract

1. every persisted state includes `schemaVersion`
2. state loading must support migration from older known versions
3. incompatible state shape changes must be expressed as explicit migrations
4. migration runs before runtime validation and state reuse

## Guardrails

- no silent breaking state shape change
- no persisted state reload without version-aware normalization
