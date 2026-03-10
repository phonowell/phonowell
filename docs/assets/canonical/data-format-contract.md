---
dropId: drop-canon-data-format-contract
type: canonical-bundle
domain: protocol
scope: well-global
owner: orchestrator-core
layer: contract
priority: p0
title: Canonical Data Format Contract Asset
active: true
---
# Canonical Data Format Contract Asset

## Purpose

Single source of truth for the standard phonowell data model and persistence format.
This asset defines how active assets, runtime state, generation diffs, and verification evidence must be represented.

## Contract

1. standard entities
- `project`
- `well`
- `drop`
- `relation`
- `packet-record`
- `candidate-artifact`
- `verify-report`
- `verify-cycle`
- `self-iteration-record`

2. standard asset metadata
- every active asset must carry `drop-id`, `type`, `domain`, `scope`, `owner`, `priority`, `title`
- active runtime drops inherit the same normalized metadata shape
- source-of-truth assets must preserve `source-file` for traceability

3. constrained vocabularies
- core categorical fields use explicit allowed values instead of free strings
- required constrained fields include at least:
- `type`
- `domain`
- `scope`
- `source`
- `relation-type`
- `priority`
- `owner`

4. standard runtime container
- active project state persists as one top-level `state.json`
- top-level state sections must include:
- `project`
- `well`
- `drops`
- `relations`
- `candidates`
- `verifyReports`
- `verifyCycles`
- `selfIterationRecords`
- `packetRecords`
- `pendingChangedDropIds`
- `runLogs`
- `unresolvedQuestions`

5. diff contract
- generation diff must include asset additions, removals, changes, and relation deltas
- diff must expose changed well-level fields when goal, acceptance, definition of done, or constraints move

6. schema and validation
- canonical active asset metadata must be validated on load
- persisted runtime state must be normalized and validated before reuse
- schema files are implementation artifacts that derive from this contract, not a parallel source of truth

## Guardrails

- no active runtime entity with missing `owner`
- no free-form categorical values for core asset fields
- no persisted project state reload without contract normalization
- no generation diff that hides relation or well-field changes
