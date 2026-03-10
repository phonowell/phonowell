---
dropId: drop-canon-acceptance-contract
type: canonical-bundle
domain: core
scope: well-global
owner: product-core
layer: contract
priority: p0
title: Canonical Acceptance Contract Asset
active: true
---
# Canonical Acceptance Contract Asset

## Purpose

Single source of truth for artifact acceptance conditions.
This asset defines what "done" means and what must be verified before release.

## Contract Rules

1. One explicit acceptance contract per well
- each well must bind exactly one active acceptance contract
- acceptance contract is created early and can be refined during iteration

2. Structured acceptance dimensions
- self-iteration and self-management capability
- functional outcome
- quality constraints
- scope boundaries
- failure-path visibility
- delivery evidence

Self-iteration acceptance requirements:
- product can ingest its own improvement inputs as assets
- product can run dry-run -> generate -> verify on its own project graph
- product can persist and replay iteration evidence across cycles
- product can update project assets/rules through explicit asset changes instead of hidden state

3. Testability and observability
- each acceptance item must be checkable in dry-run or verify stage
- non-checkable items are marked invalid until rewritten
- self-iteration evidence must include at least:
- one completed self-improvement cycle record
- one verify report with acceptance coverage linked to changed assets
- one re-run showing state consistency after update

4. Change governance
- acceptance contract updates trigger partial re-evaluation
- generation and verify always use latest confirmed contract

## Guardrails

- no release candidate without explicit acceptance contract link
- no verify pass without acceptance coverage evidence
- no hidden acceptance criteria outside asset graph
