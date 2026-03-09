# Task Plan: immediate ingest flow

## Goal
- 调整流程为“资产先落库并可见，再执行分析/冲突标注/重评估”，降低阻塞感并保持用户心流。

## Steps
1. [completed] 更新 execution protocol：将 ingest 前置为硬规则，并重排状态流。
2. [completed] 更新 workflow：重排阶段定义，明确后置分析为非阻塞。
3. [completed] 更新 product model 与 README：同步“先 ingest”对外与对内规则。
4. [completed] 一致性校验并回写计划状态。

## Validation
- `rg 'state machine|state flow|ingest|first-principles-modeling|non-blocking|high-level flow' docs README.md`
