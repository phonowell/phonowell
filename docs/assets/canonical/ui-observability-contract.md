---
dropId: drop-canon-ui-observability-contract
type: canonical-bundle
domain: delivery
scope: well-global
owner: webui-core
layer: policy
priority: p0
title: Canonical UI Observability Contract Asset
active: true
---
# Canonical UI Observability Contract Asset

## Purpose

Single source of truth that the WebUI must expose the key phonowell control signals instead of hiding them behind implementation internals.

## Contract

1. WebUI exposes at least:
- active asset count
- generation diff summary
- schema version
- schema manifest visibility
- gate summary

2. visibility is glanceable in default mode
3. observability should not increase normal user action count

## Guardrails

- no hidden schema/version state during active development
- no gate-only signals trapped in CLI output
