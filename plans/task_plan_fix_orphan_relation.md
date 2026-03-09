# Task Plan: fix orphan relation

## Goal
- 修复资产关系中未定义目标导致的 dry-run fail。

## Steps
1. [completed] 清理 `asset-registry` 中指向未定义 drop 的关系。
2. [completed] 校验 active 资产关系是否均指向存在的 drop。
3. [completed] 重跑 dry-run 口径并确认 gate 结果。

## Validation
- `rg 'drop-workflow-system-core|rel-' docs/assets/asset-registry.md`
