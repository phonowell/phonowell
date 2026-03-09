# Core Goal Origin Asset

## Asset Metadata

- `drop-id`: `drop-goal-origin-rule`
- `type`: `principle`
- `scope`: `well-global`
- `owner`: `product-core`

## Rule

Each well must have exactly one `goal-origin` drop.
It is the project anchor and the origin of all asset relations.

## Generation and Editing

1. AI proposes an initial goal-origin draft from existing drops.
2. User can edit the goal manually at any time.
3. AI can refine goal text on request.
4. Goal changes trigger full project re-evaluation.

## Minimal Goal-Origin Schema

- `drop-id`: `drop-goal-origin-*`
- `well-id`
- `type`: `goal-origin`
- `title`
- `intent`
- `definition-of-done`
- `constraints`
- `status`: `draft | confirmed | revised`
- `source`: `ai-generated | user-authored | hybrid`

## Guardrails

- no generation starts before goal-origin is at least `confirmed`
- no orphan drops disconnected from goal-origin in final graph
- no hidden goal mutation without explicit user visibility
