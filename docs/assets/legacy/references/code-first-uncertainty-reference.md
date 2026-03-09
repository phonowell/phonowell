# Code-First Uncertainty Reference Asset

## Asset Metadata

- `drop-id`: `drop-ref-code-first-uncertainty`
- `type`: `reference-principle`
- `domain`: `reference`
- `scope`: `well-global`
- `owner`: `engineering-core`
- `priority`: `p0`

## Purpose

Reference principle to reduce uncertainty through concrete code implementation, delegating only inherently LLM-only work to LLM.

## Source

- principle: `产品依赖代码实现来消除不确定性，仅“只有 llm 能做”的事情才交给 llm`
- role: execution strategy constraint for implementation planning and task routing

## Intended Scope

1. prioritize deterministic code paths for product behavior and validation
2. route tasks to LLM only when they cannot be reliably solved by explicit program logic
3. keep LLM outputs bounded by verifiable contracts

## Non-Scope

- no LLM-first design for deterministic engineering tasks
- no replacement of core runtime contracts with prompt-only behavior
