# Task Plan: v1 missing assets generation

## Goal
- 生成 V1 成功产出所需的 5 类关键资产，并登记为可追踪一等资产。

## Steps
1. [completed] 建立计划与执行备注文件。
2. [completed] 新增 5 份 V1 资产文档（定义/线框/映射/契约/里程碑）。
3. [completed] 更新资产登记与关系图谱。
4. [completed] 更新 README 入口与资产导航。
5. [completed] 校验行数与引用一致性，回写计划状态。

## Validation
- `find ./docs -maxdepth 4 -type f | sort`
- `wc -l` for all new markdown files
- `rg "drop-v1-|rel-v1-" docs/assets/asset-registry.md`

## Result
- 缺失的 5 类执行资产已全部生成并纳入一等资产注册，V1 可进入实现阶段。
