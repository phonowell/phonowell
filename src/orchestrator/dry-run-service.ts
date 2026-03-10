import type { Drop, DryRunCheck, DryRunReport, DryRunStatus, Relation, Well, WellState } from "./types.js";

interface DryRunEvaluation {
  checks: DryRunCheck[];
  counters: Omit<DryRunReport, "checks" | "createdAt" | "gateResult" | "gateReason">;
}

function gate(name: DryRunCheck["name"], status: DryRunStatus, critical: boolean, evidence: string[]): DryRunCheck {
  return { name, status, critical, evidence };
}

function activeDrops(state: WellState): Drop[] {
  return state.drops.filter((drop) => drop.lifecycleState !== "archived");
}

function relationCount(relations: Relation[], dropId: string): number {
  return relations.filter((rel) => rel.fromDropId === dropId || rel.toDropId === dropId).length;
}

export function evaluateDryRun(state: WellState): DryRunEvaluation {
  const drops = state.drops;
  const relations = state.relations;
  const goal = drops.find((drop) => drop.type === "goal-origin");
  const visible = activeDrops(state);

  const orphanCount = visible.filter((drop) => !relations.some((rel) => rel.fromDropId === drop.dropId || rel.toDropId === drop.dropId)).length;
  const unclearCount = visible.filter((drop) => !drop.content || drop.content.trim().length < 8).length;
  const missingPurposeCount = visible.filter((drop) => !drop.purpose || drop.purpose.trim().length < 8).length;

  const acceptanceBound = Boolean(state.well.acceptanceDropId) && drops.some((drop) => drop.dropId === state.well.acceptanceDropId);
  const acceptanceUncheckableCount = state.well.definitionOfDone.filter((item) => item.trim().length < 8).length;
  const selfIterationEvidencePathMissingCount = state.verifyReports.length > 0 ? 0 : 1;
  const missingRequiredCapabilityCount = [
    goal ? 0 : 1,
    state.well.definitionOfDone.length > 0 ? 0 : 1,
    drops.some((drop) => drop.dropId === "drop-canon-execution-protocol") ? 0 : 1,
  ].reduce((sum, n) => sum + n, 0);
  const highConflictCount = state.unresolvedQuestions.length > 0 ? 1 : 0;

  const overlapKeyMap = new Map<string, number>();
  for (const rel of relations) {
    const key = `${rel.fromDropId}|${rel.toDropId}|${rel.relationType}`;
    overlapKeyMap.set(key, (overlapKeyMap.get(key) ?? 0) + 1);
  }
  const overlapCount = [...overlapKeyMap.values()].filter((count) => count > 1).length;
  const contradictionCount = relations.filter((rel) => rel.fromDropId === rel.toDropId).length;

  const summaryKeyMap = new Map<string, number>();
  for (const drop of visible) {
    const key = drop.summary.trim().toLowerCase();
    if (key.length < 12) continue;
    summaryKeyMap.set(key, (summaryKeyMap.get(key) ?? 0) + 1);
  }
  const redundancyCount = [...summaryKeyMap.values()].filter((count) => count > 1).length;
  const designErrorCount = visible.filter((drop) => drop.priority === "p0" && drop.scope === "run-local" && !drop.parentDropId).length;
  const lowRoiCount = visible.filter((drop) => drop.priority === "p0" && drop.type === "note").length;

  const checks: DryRunCheck[] = [
    gate("closure", missingRequiredCapabilityCount > 0 || !goal || (goal.goalStatus ?? "draft") !== "confirmed" ? "fail" : "pass", true, [
      goal ? `goal-origin=${goal.dropId}` : "goal-origin missing",
      `definition-of-done=${state.well.definitionOfDone.length}`,
    ]),
    gate("acceptance", !acceptanceBound || acceptanceUncheckableCount > 0 ? "fail" : "pass", false, [
      `acceptance-bound=${String(acceptanceBound)}`,
      `acceptance-uncheckable=${acceptanceUncheckableCount}`,
    ]),
    gate("self-iteration", selfIterationEvidencePathMissingCount > 0 ? "warn" : "pass", false, [
      `self-iteration-evidence-missing=${selfIterationEvidencePathMissingCount}`,
    ]),
    gate("completeness", orphanCount > 0 ? "fail" : "pass", true, [`asset-orphan-count=${orphanCount}`]),
    gate("conflict", highConflictCount > 0 ? "fail" : "pass", true, [`unresolved-questions=${state.unresolvedQuestions.length}`]),
    gate("reuse-first", drops.some((drop) => drop.domain === "reference") ? "pass" : "warn", false, [
      `reference-drop-count=${drops.filter((drop) => drop.domain === "reference").length}`,
    ]),
    gate("reverse-validation", state.well.definitionOfDone.length >= 3 ? "pass" : "warn", false, [
      `dod-items=${state.well.definitionOfDone.length}`,
    ]),
    gate(
      "asset-clarity",
      unclearCount >= 1 || missingPurposeCount >= 1 || orphanCount >= 1
        ? "fail"
        : visible.some((drop) => drop.confidence < 0.8)
          ? "warn"
          : "pass",
      false,
      [
        `asset-unclear-count=${unclearCount}`,
        `asset-missing-purpose-count=${missingPurposeCount}`,
        `asset-orphan-count=${orphanCount}`,
      ],
    ),
    gate(
      "design-health",
      contradictionCount >= 1 || designErrorCount >= 1
        ? "fail"
        : lowRoiCount >= 1
          ? "warn"
          : "pass",
      false,
      [
        `design-overlap-count=${overlapCount}`,
        `design-contradiction-count=${contradictionCount}`,
        `design-redundancy-count=${redundancyCount}`,
        `design-error-count=${designErrorCount}`,
        `design-low-roi-count=${lowRoiCount}`,
      ],
    ),
  ];

  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const criticalWarnCount = checks.filter((c) => c.critical && c.status === "warn").length;
  const criticalFailCount = checks.filter((c) => c.critical && c.status === "fail").length;

  return {
    checks,
    counters: {
      checkTotal: checks.length,
      passCount,
      warnCount,
      failCount,
      criticalWarnCount,
      criticalFailCount,
      highConflictCount,
      missingRequiredCapabilityCount,
      acceptanceUnboundCount: acceptanceBound ? 0 : 1,
      acceptanceUncheckableCount,
      selfIterationEvidencePathMissingCount,
      assetUnclearCount: unclearCount,
      assetMissingPurposeCount: missingPurposeCount,
      assetOrphanCount: orphanCount,
      designOverlapCount: overlapCount,
      designContradictionCount: contradictionCount,
      designRedundancyCount: redundancyCount,
      designErrorCount,
      designLowRoiCount: lowRoiCount,
    },
  };
}
