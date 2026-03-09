# Task Plan: protocol and rule assets

## Goal
- 将 chat-to-asset 协议与两条新规则（资产最小化、入资产后冲突标注并在运行前检查）加入全局资产列表。

## Steps
1. [completed] 新增协议资产文档并写入两条规则。
2. [completed] 更新资产注册表并建立关系。
3. [completed] 同步 workflow 与 README 的流程和入口。
4. [completed] 校验一致性并回写计划状态。

## Validation
- `rg "chat-to-asset|冲突|最少|minimal" docs README.md`
- `wc -l` for changed markdown files

## Result
- 协议与两条规则已成为全局一等资产，流程改为“先入资产、后标注冲突、运行前检查风险”。
