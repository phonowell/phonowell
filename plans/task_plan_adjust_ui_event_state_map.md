# Task Plan: adjust ui event-state map

## Goal
- 将 V1 事件/状态映射收敛到极简画布交互模型。

## Steps
1. [completed] 读取现有映射并识别与新 IA 冲突项。
2. [completed] 重写事件、状态与迁移约束到极简模式。
3. [completed] 校验内容一致性并回写计划状态。

## Validation
- `sed -n` 检查文档
- `wc -l` 检查行数

## Result
- 事件模型已对齐“拖拽+连线+AI 自动整理+摘要双编辑模式”的 V1 交互。
