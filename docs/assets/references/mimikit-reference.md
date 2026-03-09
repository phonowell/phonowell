# Mimikit Reference Asset

## Asset Metadata

- `drop-id`: `drop-ref-mimikit-openai-llm`
- `type`: `reference-project`
- `domain`: `reference`
- `scope`: `well-global`
- `owner`: `architecture-core`
- `priority`: `p1`

## Purpose

Reference source for proven orchestration and OpenAI/LLM interaction patterns that can be reused in `phonowell` with minimal adaptation cost.

## Source

- local path: `~/Projects/mimikit`
- repository role: orchestration-focused AI project

## Intended Reference Scope

1. `OpenAI provider` implementation approach
2. selected `LLM interaction` patterns

## Explicit Non-Scope

- do not copy unrelated modules
- do not import full architecture as-is
- do not introduce compatibility layers that violate phonowell simplification

## Usage Notes

- reference only patterns with high ROI and clear fit to `phonowell` runtime contract
- keep `phonowell` as pure orchestration layer
- all adopted patterns must map back to existing asset constraints
