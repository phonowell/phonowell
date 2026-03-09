# Task Plan: explicit dry-run and reverse validation

## Goal
- 在生成产物前引入显式 dry-run 预检与反向验证，并补全可执行步骤。

## Steps
1. [completed] 在 execution protocol 增加 dry-run 与 reverse validation 详细步骤。
2. [completed] 在 workflow 增加显式阶段与门禁判定。
3. [completed] 在 product model 增加生成前门禁规则。
4. [completed] 在 README 与 asset registry 同步入口说明。
5. [completed] 校验一致性并回写计划状态。

## Validation
- `rg 'dry run|dry-run|reverse validation|preflight|gate|boundary' docs README.md`

## Result
- 生成前门禁已固化：显式 dry-run + 反向验证成为产物生成前置步骤。
