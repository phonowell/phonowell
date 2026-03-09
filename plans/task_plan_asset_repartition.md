# Task Plan: asset repartition by granularity standard

## Goal
- 按 blast radius 标准重分区资产，减少高耦合碎片资产并建立 canonical 资产层。

## Steps
1. [completed] 设计新的 canonical 资产分区结构。
2. [completed] 新建 core/execution/v1 三个 canonical 资产文档。
3. [completed] 将旧碎片资产迁移到 legacy 目录。
4. [completed] 重写资产注册表为 canonical 视图。
5. [completed] 同步 README、product-model、workflow 引用。
6. [completed] 校验资产数与关系复杂度下降并回写计划。

## Validation
- `find docs/assets -maxdepth 3 -type f | sort`
- `rg "drop-canon|legacy" docs`
- `wc -l` for changed markdown files

## Result
- 活跃资产已重分区为 3 个 canonical 资产 + 1 个参考资产；旧碎片资产归档到 legacy。
