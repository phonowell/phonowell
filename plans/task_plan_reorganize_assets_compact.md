# Task Plan: reorganize assets compact

## Goal
- 按低心智负担原则重整资产：减少 active 资产数量，合并重叠 reference 规则，同时保持现有约束不丢失。

## Steps
1. [completed] 新增合并后的工程执行 reference 资产，覆盖 typescript/tsx/code-first/no-question-in-generate 语义。
2. [completed] 更新 product-model 与 asset-registry：active 清单和关系图切换到合并资产，并将被合并资产降级为 legacy。
3. [completed] 更新 README 对外资产列表与默认规则描述，保持叙事一致。
4. [completed] 重跑 dry-run 并回写计划状态。

## Validation
- `rg 'drop-ref-engineering-execution|drop-ref-typescript|drop-ref-tsx-direct-run|drop-ref-code-first-uncertainty|drop-ref-no-question-in-generate|legacy' docs README.md`
