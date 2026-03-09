# Task Plan: domain+scope model and low cognitive load principle

## Goal
- 正式引入 domain + scope（tags 降级为可选展示字段），并把低心智负担并入 canonical 原则。

## Steps
1. [completed] 更新 product model 字段定义与治理规则。
2. [completed] 更新 core/execution canonical 资产原则与协议默认行为。
3. [completed] 更新 workflow、registry、README 的一致性表达。
4. [completed] 校验术语与约束一致并回写计划状态。

## Validation
- `rg "domain|scope|tags|cognitive|心智|low cognitive" docs README.md`
- `wc -l` for changed markdown files

## Result
- domain+scope 已成为治理主字段，tags 已降级；低心智负担成为核心原则并进入执行协议默认行为。
