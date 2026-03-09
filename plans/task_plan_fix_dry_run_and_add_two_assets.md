# Task Plan: fix dry-run and add two assets

## Goal
- 修复 dry-run 阈值口径不一致并验证通过；随后新增两条规则资产并接入 active 图。

## Steps
1. [completed] 修复 execution-protocol 中 dry-run check set size/报告字段与 checklist 对齐。
2. [completed] 重跑 dry-run 并确认 gate=pass。
3. [completed] 新增两条 reference 资产并更新 registry/product-model/README。
4. [completed] 一致性校验并回写计划状态。

## Validation
- `rg 'check set size|acceptance check|self-iteration check|llm|generate stage|no question|dry-run' docs README.md`
