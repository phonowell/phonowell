---
dropId: drop-canon-workdir-contract
type: canonical-bundle
domain: protocol
scope: well-global
owner: orchestrator-core
layer: contract
priority: p0
title: Canonical Workdir Contract Asset
active: true
---
# Canonical Workdir Contract Asset

## Purpose

Single source of truth that the default phonowell project work directory is `.phonowell`.

## Contract

1. default project root
- each project stores runtime state, logs, generated artifacts, and replay evidence under `.phonowell`
- `.phonowell` is the stable working directory name unless an explicit project setting overrides its parent path

2. runtime storage expectations
- persisted state path is scoped under the active project workdir
- logs, packet records, and generation diffs are project-local

3. tooling expectations
- CLI, server, and WebUI must resolve the active project against `.phonowell`
- implementation should not scatter hidden runtime files at repository root once project mode is enabled
