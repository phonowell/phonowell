# Task Plan: trim overdesign

## Goal
- 砍掉当前轻度过重设计：索引层重复与指标层偏多。

## Steps
1. [completed] 取消 asset-inventory 的活跃 canonical 角色。
2. [completed] 重写 registry 与 README，移除重复索引入口。
3. [completed] 精简质量指标到最小集。
4. [completed] 校验一致性并回写计划状态。

## Validation
- `rg "asset-inventory|coupling density|revision churn" docs README.md`
- `find docs/assets -maxdepth 3 -type f | sort`

## Result
- 活跃设计已减重：移除重复索引角色，质量指标收敛为 blast radius + parallel throughput。
