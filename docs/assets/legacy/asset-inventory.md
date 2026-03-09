# Canonical Asset Inventory

## Asset Metadata

- `drop-id`: `drop-canon-asset-inventory`
- `type`: `canonical-bundle`
- `domain`: `core`
- `scope`: `well-global`
- `owner`: `architecture-core`

## Purpose

Low-cognitive-load index of active assets, organized by `domain + scope`.

## Active Assets By Domain

### `core`

1. `drop-canon-core-foundation`
- scope: `well-global`
- file: `docs/assets/canonical/core-foundation.md`

2. `drop-canon-asset-inventory`
- scope: `well-global`
- file: `docs/assets/canonical/asset-inventory.md`

### `protocol`

1. `drop-canon-execution-protocol`
- scope: `well-global`
- file: `docs/assets/canonical/execution-protocol.md`

### `delivery`

1. `drop-canon-v1-delivery`
- scope: `well-global`
- file: `docs/assets/canonical/v1-delivery.md`

### `reference`

1. `drop-ref-mimikit-openai-llm`
- scope: `well-global`
- file: `docs/assets/references/mimikit-reference.md`

2. `drop-ref-react-19`
- scope: `well-global`
- file: `docs/assets/references/react-19-reference.md`

### `legacy`

- archived under `docs/assets/legacy/`
- not active source of truth

## Usage Rule

When adding a new asset:

1. assign `domain` first
2. assign `scope` second
3. reject if it duplicates an existing canonical asset purpose
