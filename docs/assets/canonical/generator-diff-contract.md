---
dropId: drop-canon-generator-diff-contract
type: canonical-bundle
domain: protocol
scope: well-global
owner: orchestrator-core
layer: contract
priority: p0
title: Canonical Generator Diff Contract Asset
active: true
---
# Canonical Generator Diff Contract Asset

## Purpose

Single source of truth that generation must consume asset-management diffs so the generator updates existing artifacts incrementally instead of fully regenerating every time.

## Contract

1. diff-before-generate
- each generate cycle computes an asset-management diff against the latest accepted or latest generated artifact state
- generator receives the diff as explicit context

2. diff scope
- added assets
- removed assets
- changed assets
- changed relations
- changed acceptance or constraint context

3. generation mode
- default mode is incremental modification
- full regeneration is an explicit fallback, not the default path

## Guardrails

- no blind full rewrite on every generate
- no generator call without visible diff evidence once prior artifact state exists
