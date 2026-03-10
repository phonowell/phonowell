---
dropId: drop-canon-asset-layering-contract
type: canonical-bundle
domain: core
scope: well-global
owner: product-core
layer: contract
priority: p0
title: Canonical Asset Layering Contract Asset
active: true
---
# Canonical Asset Layering Contract Asset

## Purpose

Single source of truth that active assets must distinguish hard contracts from default policy and reference guidance.

## Contract

1. active asset layers are explicit
- `contract`
- `policy`
- `reference`

2. canonical bundles default to `contract`
3. references default to `reference`
4. runtime and UI should expose asset layer so users can distinguish hard rules from guidance

## Guardrails

- no mixing mandatory contract and optional guidance without visible layer
- no reference asset treated as hard gate without explicit promotion
