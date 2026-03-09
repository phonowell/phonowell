# V1 Artifact Definition Asset

## Asset Metadata

- `drop-id`: `drop-v1-artifact-definition`
- `type`: `spec`
- `scope`: `well-global`
- `owner`: `product-core`

## Artifact Target

- `artifact-type`: `app`
- `artifact-name`: `phonowell WebUI V1`
- `one-line-goal`: 用最少交互完成资产导入、关系表达与 AI 自动整理，生成单一目标产物。

## Core Experience Rule

用户只做两件事：

1. 拖拽资产进画布
2. 拖拽连线表达关系

其余整理工作由 AI 自动完成。

## Definition of Done

1. AI 可根据现有资产自动生成一个 `goal-origin` 草案。
2. 用户可手动编辑并确认 `goal-origin`，且界面始终可见其当前状态。
3. 用户可在空白画布中拖拽导入 `image/doc/url/note` 资产。
4. AI 自动分析每个资产并生成摘要卡片。
5. 资产自动布局为思维导图风格结构（中心目标 + 外围资产）。
6. 用户可通过拖拽快速连线，AI 可自动补充候选关系。
7. 点击资产可查看摘要卡；摘要可手动编辑或 AI 驱动改写。
8. 在资产、关系或目标变化后，AI 自动重评估完整性并更新产物生成准备状态。

## Out of Scope

- 多层级复杂控制面板
- 实时多人协作
- 多产物并行生成
- 高级手工布局工具箱

## Acceptance Checks

- 首次导入后 5 秒内出现资产摘要与自动布局结果
- 任意连线后，AI 在一次刷新内更新关系理解
- 摘要卡支持手动编辑和 AI 编辑两种模式
- 未确认 `goal-origin` 前不可触发生成
