import type { RequirementDiffEntry, WellState } from "./types.js";

export type WorkspaceViewMode = "quick-task" | "domain-map";

export interface WorkspaceViewSnapshot {
  suggestedMode: WorkspaceViewMode;
  reasons: string[];
  metrics: {
    userAssetCount: number;
    workspaceDomainCount: number;
    domainEdgeCount: number;
    structuralCorrectionCount: number;
    hasStructuralGenerationDiff: boolean;
  };
}

function isStructuralDiffEntry(entry: RequirementDiffEntry): boolean {
  return entry.key.startsWith("domain:") || entry.key.startsWith("inbox:");
}

export function summarizeWorkspaceView(state: WellState): WorkspaceViewSnapshot {
  const visibleDrops = state.drops.filter((drop) => drop.lifecycleState !== "archived");
  const userAssetCount = visibleDrops.filter((drop) =>
    drop.source === "user" && drop.type !== "goal-origin",
  ).length;
  const workspaceDomainCount = state.domainNodes.filter((node) =>
    node.kind === "workspace" && node.assetDropIds.length > 0,
  ).length;
  const domainEdgeCount = state.domainEdges.length;
  const structuralCorrectionCount = state.activityTimeline.filter((item) =>
    item.kind === "correction" || item.kind === "domain-updated",
  ).length;
  const hasStructuralGenerationDiff = Boolean(
    state.generationHistory[0]?.diff.entries.some(isStructuralDiffEntry),
  );

  const promoteReasons: string[] = [];
  if (userAssetCount > 10) {
    promoteReasons.push(`资产数已到 ${userAssetCount}，超过 Quick Task 阈值 10。`);
  }
  if (workspaceDomainCount >= 2) {
    promoteReasons.push(`系统已经识别出 ${workspaceDomainCount} 个稳定 domain。`);
  }
  if (domainEdgeCount > 0) {
    promoteReasons.push(`当前已有 ${domainEdgeCount} 条 domain 关系线。`);
  }
  if (structuralCorrectionCount >= 3) {
    promoteReasons.push("你已经开始频繁做结构纠偏，说明任务正在变复杂。");
  }
  if (hasStructuralGenerationDiff) {
    promoteReasons.push("最近一次生成 diff 已经出现结构变化，不只是内容变化。");
  }

  if (promoteReasons.length > 0) {
    return {
      suggestedMode: "domain-map",
      reasons: promoteReasons,
      metrics: {
        userAssetCount,
        workspaceDomainCount,
        domainEdgeCount,
        structuralCorrectionCount,
        hasStructuralGenerationDiff,
      },
    };
  }

  return {
    suggestedMode: "quick-task",
    reasons: [
      userAssetCount === 0
        ? "当前还是空任务，先用轻量模式承载。"
        : `当前只有 ${userAssetCount} 个用户资产，仍适合 Quick Task。`,
    ],
    metrics: {
      userAssetCount,
      workspaceDomainCount,
      domainEdgeCount,
      structuralCorrectionCount,
      hasStructuralGenerationDiff,
    },
  };
}
