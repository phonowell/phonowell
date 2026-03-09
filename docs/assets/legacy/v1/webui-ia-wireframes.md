# V1 WebUI IA & Wireframe Asset

## Asset Metadata

- `drop-id`: `drop-v1-webui-ia-wireframes`
- `type`: `design-spec`
- `scope`: `well-global`
- `owner`: `webui-core`

## IA Principle

极简画布优先。
默认界面只有“画布 + 少量浮层”，避免复杂操作面板。

## Information Architecture

1. `Main Canvas`
- 空白起始画布
- 中心固定 `goal-origin` 节点
- 围绕目标自动布局的 `drop` 节点与关系边

2. `Top Minimal Bar`
- well 名称
- 当前状态点（goal-draft/analyzing/organizing/ready/generating）
- 一个主按钮：`Generate`

3. `Goal-Origin Card Popover`
- 目标标题与目标意图
- `Edit Manually`
- `Refine with AI`
- `Confirm Goal`

4. `Asset Card Popover`
- 点击节点弹出摘要卡
- 摘要文本
- `Edit Manually`
- `Refine with AI`

5. `Lightweight Assist Layer`
- AI 自动整理提示
- 缺失信息轻提示
- 自动关系建议确认

## Wireframe (Text)

- Top: `[Well Name] [State Dot] [Generate]`
- Center: `[Goal-Origin Node at center] + [Auto-organized mindmap nodes]`
- On Goal Click: `[Goal Card | Manual Edit | AI Refine | Confirm Goal]`
- On Asset Click: `[Summary Card | Manual Edit | AI Refine]`
- Floating Hint: `[AI Suggestion / Missing Info]`

## Interaction Rules

- 用户拖拽资产到画布即触发 AI 分析与自动布局
- 用户拖拽节点到节点即可创建连线
- AI 可提议连线，用户一键确认或忽略
- 用户修改摘要或目标后，AI 重新评估受影响关系
- 目标未确认时，`Generate` 按钮保持禁用
- 无常驻复杂侧边栏或底部控制台
