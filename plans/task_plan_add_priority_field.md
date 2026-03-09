# Task Plan: add priority field

## Goal
- 新增轻量 priority 字段（`p0|p1|p2`）用于资产重要度标记。

## Steps
1. [completed] 更新 product model 字段定义。
2. [completed] 更新 execution protocol 的默认赋值与使用方式。
3. [completed] 更新 README 与 registry 规则说明。
4. [completed] 补齐活跃资产元数据 priority 并校验一致性。

## Validation
- `rg 'priority|p0|p1|p2' docs README.md`

## Result
- priority 已作为轻量重要度字段落地，并进入执行排序规则。
