# First-Principles Thinking Asset

## Asset Metadata

- `drop-id`: `drop-principle-first-principles`
- `type`: `principle`
- `scope`: `well-global`
- `owner`: `product-core`

## Core Rule

Phonowell must reason from first principles before committing execution decisions.

## Problem Reality

Users often cannot fully articulate what they want at the start.
Initial requests are treated as intent signals, not final truth.

## Method

1. Decompose request into fundamentals:
- objective
- constraints
- success criteria
- non-goals

2. Build intent hypotheses:
- AI proposes one or more goal hypotheses
- each hypothesis must map to evidence from assets/chat

3. Converge explicitly:
- user confirms or edits the goal-origin
- system keeps uncertainty visible until confirmed

## Operational Impact

- goal-origin generation must include first-principles decomposition
- conflict annotation should include assumption-level conflicts
- pre-run check must report unresolved intent uncertainty

## Guardrails

- no blind execution from raw chat text
- no hidden assumption promoted to confirmed goal
- uncertainty must be explicit and editable
