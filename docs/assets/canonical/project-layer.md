---
dropId: drop-canon-project-layer
type: canonical-bundle
domain: delivery
scope: well-global
owner: delivery-core
layer: contract
priority: p0
title: Canonical Project Layer Asset
active: true
---
# Canonical Project Layer Asset

## Purpose

Single source of truth for introducing a `project` layer above wells so users can manage multiple phonowell projects.

## Contract

1. project layer
- system supports multiple projects
- each project owns its own workdir, state, assets, and generated artifacts

2. project actions
- create project
- switch active project
- delete project

3. runtime expectations
- active project selection controls which `.phonowell` workspace is mounted
- switching project must fully swap runtime state instead of mixing assets across projects
- deleting project must remove only that project's managed runtime data

## Guardrails

- no cross-project hidden state bleed
- no shared active graph between unrelated projects
