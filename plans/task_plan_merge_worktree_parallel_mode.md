# Task Plan: merge worktree parallel mode asset

## Goal
- 将“worktree 并行开发提速”并入现有 canonical 资产，不新增独立资产文件。

## Steps
1. [completed] 合并到 execution protocol 的交付策略。
2. [completed] 同步 v1 delivery 的执行窗口说明。
3. [completed] 更新 asset registry 关系证据与 README 提示。
4. [completed] 校验一致性并回写计划状态。

## Validation
- `rg "worktree|parallel|并行" docs README.md`
- `wc -l` for changed markdown files

## Result
- worktree 并行开发已并入 canonical 执行协议与 V1 交付资产，无新增碎片资产。
