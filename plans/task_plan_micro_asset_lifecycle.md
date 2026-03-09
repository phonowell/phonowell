# Task Plan: micro asset lifecycle hardening

## Goal
- 固化小资产管理规则（候选->晋升->归档），并接入协议与模型。

## Steps
1. [completed] 在 execution protocol 增加小资产生命周期规则。
2. [completed] 在 product model 增加最小必要字段承载生命周期状态。
3. [completed] 在 workflow 增加小资产处理要点。
4. [completed] 在 README 增加规则入口并校验一致性。

## Validation
- `rg 'micro|candidate|promote|archive|run-local|parent-drop-id' docs README.md`

## Result
- 小资产生命周期已固化：默认候选、条件晋升、里程碑归档；由 AI 默认管理并支持用户覆盖。
