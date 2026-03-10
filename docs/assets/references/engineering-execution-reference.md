---
dropId: drop-ref-engineering-execution
type: reference-engineering
domain: reference
scope: well-global
owner: engineering-core
layer: reference
priority: p0
title: Engineering Execution Reference Asset
active: true
---
# Engineering Execution Reference Asset

## Purpose

Unified engineering execution reference to keep delivery deterministic, low-friction, and non-blocking for users.

## Source

- merged principles: `TypeScript`, `tsx direct run`, `code-first uncertainty reduction`, `no question in generate`
- role: single execution strategy baseline for implementation and runtime flow

## Intended Scope

1. use explicit code implementation to remove uncertainty; delegate only inherently LLM-only tasks to LLM
2. default language/runtime for iteration: TypeScript + direct tsx startup
3. require all user-facing questions to be closed in dry-run; generate stage remains execution-only
4. keep implementation verifiable through contracts and observable run evidence

## Non-Scope

- no compile-first requirement in normal dev iteration
- no LLM-first replacement for deterministic engineering logic
- no questioning users during generate stage
