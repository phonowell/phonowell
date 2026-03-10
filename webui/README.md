# WebUI

`webui` 现在收敛为一个单画布产品，但有两种自动展开层级：

- `Quick Task`：简单、单目标、小规模任务
- `Domain Map`：资产与结构已经复杂化的任务

## 当前主路径

- 简单任务默认展示 `Quick Task`
- 复杂任务自动升格为全局 `domain map`
- 新资产先进 `Inbox`，再由 AI 自动归类或新建 domain
- 点击 domain 进入二级 `focus mode`，查看 cluster map
- 通过资产级纠偏、送回 inbox、冻结归属、全局输入器直接修正 AI 判断
- 在右侧抽屉查看活动时间线、当前产物、以及相对上次生成的需求 diff

## 设计边界

- 首屏固定动作只保留 `整理资产 / 预检 / 生成产物`
- `Quick Task` 与 `Domain Map` 共享同一底层数据模型，不做双轨产品
- 添加资产通过右下角浮动按钮和弹窗完成，支持拖放文件
- 全局输入器和活动/产物抽屉保持轻量，不做常驻大聊天面板
- domain map 使用成熟第三方图编辑库，而不是手写节点/缩放/连线底层

## 技术说明

- 仍然是最小静态 React 19 客户端：`index.html + app.js + styles.css`
- 画布与图编辑能力由 `@xyflow/react` 提供
- 通过 `/api/*` 与 `src/server.ts` 提供的接口通信
