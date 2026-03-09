# V1 External Runtime Contract Asset

## Asset Metadata

- `drop-id`: `drop-v1-runtime-contract`
- `type`: `interface-spec`
- `scope`: `well-global`
- `owner`: `runtime-bridge`

## Contract Goal

`phonowell` only orchestrates.
Execution is delegated to external runtimes via typed packets.

## Packet Types

1. `packet-analyze-request`
- input: `dropId,type,contentRef,hints`
- output: `summary,signals,confidence,licenseState`

2. `packet-gap-fill-request`
- input: `wellId,missingSlots,evidenceRefs,mode`
- output: `generatedDrops[]`

3. `packet-generate-request`
- input: `wellId,artifactType,graphSnapshot,definitionOfDone`
- output: `candidateRef,runReport`

4. `packet-verify-request`
- input: `candidateRef,definitionOfDone,constraints`
- output: `pass,issues,suggestions`

## Error Contract

- all runtime failures return typed error:
- `error-id` with prefix `error-`
- `stage`
- `reason`
- `retryable`
- `evidence`

## Minimal SLA for V1

- analyze response: <= 12s target
- generate response: <= 60s target
- explicit failure beats silent timeout
