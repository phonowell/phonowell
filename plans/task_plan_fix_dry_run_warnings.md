# Task Plan: fix dry-run warnings

## Goal
- 处理 dry-run 发现的两项告警：门禁阈值量化 + 用户覆盖触发条件。

## Steps
1. [completed] 在 execution protocol 增加 pass/warn/fail 量化判定。
2. [completed] 在 workflow 定义 AI 自动分流/优先级的用户覆盖触发点。
3. [completed] 在 product model 增加最小必要字段承载阈值结果与覆盖原因。
4. [completed] 在 README 同步对外规则并校验一致性。

## Validation
- `rg 'pass \| warn \| fail|override|threshold|trigger' docs README.md`
