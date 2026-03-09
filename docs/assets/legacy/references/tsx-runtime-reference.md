# TSX Runtime Reference Asset

## Asset Metadata

- `drop-id`: `drop-ref-tsx-direct-run`
- `type`: `reference-runtime`
- `domain`: `reference`
- `scope`: `well-global`
- `owner`: `engineering-core`
- `priority`: `p1`

## Purpose

Reference runtime rule to use direct `tsx` startup instead of compile-first workflow for faster iteration.

## Source

- runtime mode: `tsx`
- rule: `不编译，直接使用 tsx 启动`

## Intended Scope

1. local development startup and iteration loops
2. documentation and scripts default to tsx execution path
3. reduce build friction in early and mid-stage delivery

## Non-Scope

- no mandatory constraint on final production packaging strategy
- no runtime choice that conflicts with verified stability requirements
