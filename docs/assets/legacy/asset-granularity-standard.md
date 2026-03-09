# Asset Granularity Standard Asset

## Asset Metadata

- `drop-id`: `drop-standard-asset-granularity`
- `type`: `standard`
- `scope`: `well-global`
- `owner`: `architecture-core`

## Core Signal

If one change repeatedly forces updates across many assets,
asset boundaries are coupled and granularity is likely too fine.

## Evaluation Metric

1. Blast Radius
- definition: number of assets that must change for one requirement update
- threshold (V1 guidance):
- `low`: 1-2 assets
- `medium`: 3-4 assets
- `high`: >=5 assets

2. Coupling Density
- definition: average required cross-references per asset update
- high density indicates weak decoupling

3. Revision Churn
- definition: repeated edits on same asset set across consecutive changes
- high churn indicates unstable partitioning

## Decision Rule

- if blast radius is `high`, prefer merging adjacent assets or introducing a higher-level canonical asset
- if coupling density remains high after merge, redesign relation boundaries

## Operational Use

- include blast-radius check in pre-commit review for docs/assets changes
- record observed blast radius in planning notes for architecture tasks
- treat rising blast radius as a refactor trigger, not a documentation burden
