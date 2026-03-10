import type {
  DryRunReport,
  Drop,
  Priority,
  PriorityLifecycleAuditRecord,
  SelfIterationRecord,
  VerifyCycleRecord,
  VerifyRouteExecution,
  VerifyReport,
  WellState,
} from "./types.js";
import { buildAcceptanceCoverage } from "./acceptance-traceability.js";

function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
}

function makeCycleId(state: WellState, report: VerifyReport): string {
  return `cycle-${stableHash(JSON.stringify({
    wellId: state.well.id,
    packetId: report.packetId ?? "none",
    changedDropIds: report.changedDropIds,
    pass: report.pass,
    verifyCount: state.verifyReports.length,
  })).slice(1, 9)}`;
}

function sameDropIdSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const leftSet = new Set(left);
  return right.every((item) => leftSet.has(item));
}

function readRouteCount(cycle: VerifyCycleRecord | undefined, kind: "fail" | "warn"): number | undefined {
  const entry = cycle?.verifyRouteEvidence.find((item) => item.startsWith(`${kind}-count=`));
  if (!entry) {
    return undefined;
  }
  const parsed = Number(entry.slice(`${kind}-count=`.length));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function pickVerifyRoute(
  report: VerifyReport,
  dryRunGate: DryRunReport["gateResult"] | undefined,
  unresolvedQuestionCount: number,
): VerifyCycleRecord["verifyRoute"] {
  if (report.pass) {
    return "regenerate";
  }
  if (dryRunGate === "fail" || unresolvedQuestionCount > 0) {
    return "gap-check";
  }
  return "analyze";
}

export function evaluatePriorityLifecycle(state: WellState): Array<{ dropId: string; from: Priority; to: Priority; reason: string }> {
  const changes: Array<{ dropId: string; from: Priority; to: Priority; reason: string }> = [];
  const unresolved = state.unresolvedQuestions.length;
  const dryRun = state.well.dryRunReport;

  for (const drop of state.drops) {
    if (drop.scope !== "run-local") {
      continue;
    }
    const from = drop.priority;
    if (dryRun?.gateResult === "fail" && unresolved > 0 && drop.lifecycleState === "promoted" && from !== "p0") {
      changes.push({ dropId: drop.dropId, from, to: "p0", reason: "blocking unresolved fail items" });
    } else if (dryRun?.gateResult === "pass" && drop.lifecycleState === "candidate" && from === "p2") {
      changes.push({ dropId: drop.dropId, from, to: "p1", reason: "improve mid-path convergence" });
    }
  }

  return changes;
}

export function listVerifyCoverageGaps(report: VerifyReport): string[] {
  const gaps: string[] = [];
  if (!report.pass) {
    gaps.push("verify report did not pass");
  }
  if (report.acceptanceCoverageDropIds.length === 0) {
    gaps.push("no acceptance coverage drop ids recorded");
  }
  if (report.acceptanceItems.length === 0) {
    gaps.push("no acceptance items recorded");
  }
  if (!report.acceptanceItems.some((item) => item.evidence.length > 0)) {
    gaps.push("no acceptance evidence attached");
  }
  if (report.changedDropCoverage.length === 0) {
    gaps.push("no changed-drop coverage recorded");
  }
  if (!report.changedDropCoverage.some((item) => item.acceptanceItemIds.length > 0)) {
    gaps.push("changed drops do not map to acceptance items");
  }
  if (report.uncoveredAcceptanceItemIds.length > 0) {
    gaps.push("acceptance items remain uncovered");
  }
  return gaps;
}

export function listVerifyAcceptanceGaps(report: VerifyReport): string[] {
  const gaps = listVerifyCoverageGaps(report);
  if (report.selfIterationEvidence.length < 2) {
    gaps.push("self-iteration evidence is incomplete");
  }
  if (!report.rerunConsistent) {
    gaps.push("rerun consistency is missing");
  }
  return gaps;
}

export function isVerifyReportReadyForAcceptance(report: VerifyReport): boolean {
  return listVerifyAcceptanceGaps(report).length === 0;
}

export function buildVerifyReport(input: {
  state: WellState;
  packetId: string;
  dryRunReport: DryRunReport;
  changedDropIds?: string[];
}): VerifyReport {
  const { state, packetId, dryRunReport } = input;
  const issues: string[] = [];
  const suggestions: string[] = [];
  const changedDropIds = [...(input.changedDropIds ?? state.pendingChangedDropIds)];
  const acceptance = buildAcceptanceCoverage(state, changedDropIds);

  if (dryRunReport.gateResult === "fail") {
    issues.push("dry-run gate is fail; candidate cannot be accepted");
    suggestions.push("resolve fail checks and re-run dry-run before regenerate");
  }
  if (acceptance.changedDropCoverage.every((item) => item.acceptanceItemIds.length === 0)) {
    issues.push("changed drops do not cover any acceptance item");
    suggestions.push("edit changed assets so each verify-relevant change links to explicit acceptance items");
  }
  if (acceptance.uncoveredAcceptanceItemIds.length > 0) {
    issues.push("acceptance items remain uncovered");
    suggestions.push("cover remaining acceptance items or downgrade the candidate scope");
  }

  const selfIterationEvidence = state.runLogs
    .filter((log) => log.stage === "dry-run" || log.stage === "generate")
    .slice(0, 2)
    .map((log) => `${log.runId}:${log.stage}:${log.status}`);

  const currentStateHash = stableHash(JSON.stringify({
    drops: state.drops.map((drop) => [drop.dropId, drop.summary, drop.priority, drop.lifecycleState ?? "none"]),
    relations: state.relations.map((rel) => [rel.fromDropId, rel.toDropId, rel.relationType]),
    unresolved: state.unresolvedQuestions,
  }));
  const lastRecord = state.selfIterationRecords[0];
  const rerunConsistent = lastRecord
    ? !sameDropIdSet(lastRecord.changedDropIds, changedDropIds) || lastRecord.stateHash === currentStateHash
    : true;

  if (selfIterationEvidence.length < 2) {
    issues.push("self-iteration evidence packet is incomplete");
    suggestions.push("run another dry-run/generate cycle and persist run logs");
  }

  return {
    pass: issues.length === 0,
    issues,
    suggestions,
    acceptanceCoverageDropIds: acceptance.acceptanceCoverageDropIds,
    acceptanceItems: acceptance.coverage,
    changedDropCoverage: acceptance.changedDropCoverage,
    uncoveredAcceptanceItemIds: acceptance.uncoveredAcceptanceItemIds,
    selfIterationEvidence,
    changedDropIds,
    rerunConsistent,
    packetId,
    createdAt: new Date().toISOString(),
  };
}

export function buildVerifyCycle(input: {
  state: WellState;
  report: VerifyReport;
  priorityRecommendations: Array<{ dropId: string; from: Priority; to: Priority; reason: string }>;
  priorityLifecycleAudits?: PriorityLifecycleAuditRecord[];
  routeExecution?: VerifyRouteExecution;
}): VerifyCycleRecord {
  const {
    state,
    report,
    priorityRecommendations,
    priorityLifecycleAudits = [],
    routeExecution,
  } = input;
  const failCount = state.well.dryRunReport?.failCount ?? 0;
  const warnCount = state.well.dryRunReport?.warnCount ?? 0;
  const verifyRoute = pickVerifyRoute(report, state.well.dryRunReport?.gateResult, state.unresolvedQuestions.length);
  const promotedToP0 = priorityRecommendations.filter((change) => change.to === "p0").length;
  const previousCycle = state.verifyCycles[0];
  const previousFailCount = readRouteCount(previousCycle, "fail");
  const previousWarnCount = readRouteCount(previousCycle, "warn");
  const repeatedRoute = Boolean(
    previousCycle
      && previousCycle.verifyRoute === verifyRoute
      && (failCount + warnCount) >= 1
      && previousFailCount !== undefined
      && previousWarnCount !== undefined
      && failCount >= previousFailCount
      && warnCount >= previousWarnCount,
  );
  const bypassViolation = state.well.dryRunReport?.gateResult === "fail" && verifyRoute === "regenerate";
  const previousAudits = previousCycle?.priorityLifecycleAudits ?? [];
  const oscillatingPriority = priorityRecommendations.some((change) =>
    previousAudits.some((audit) =>
      audit.dropId === change.dropId
      && audit.from === change.to
      && audit.to === change.from));
  const missingLifecycleEvidence = priorityLifecycleAudits.some((audit) =>
    !audit.evidence.some((item) => item.startsWith("goal-impact="))
    || !audit.evidence.some((item) => item.startsWith("risk-delta=")));
  const overrideNeeded = !report.pass
    && (promotedToP0 > 2 || oscillatingPriority || missingLifecycleEvidence || repeatedRoute || bypassViolation);

  let overrideType: VerifyCycleRecord["overrideType"];
  let overrideReason: string | undefined;
  if (bypassViolation || repeatedRoute) {
    overrideType = "verify-routing";
    overrideReason = bypassViolation
      ? "route bypassed mandatory stage after fail"
      : "same route repeated without fail/warn reduction";
  } else if (overrideNeeded) {
    overrideType = "priority-lifecycle";
    overrideReason = promotedToP0 > 2
      ? "AI promoted more than 2 drops to p0 in one cycle"
      : oscillatingPriority
        ? "same drop changed priority back and forth across consecutive cycles"
        : "priority change missing goal-impact or risk-delta evidence";
  }

  return {
    cycleId: makeCycleId(state, report),
    wellId: state.well.id,
    verifyRoute,
    verifyRouteEvidence: [`fail-count=${failCount}`, `warn-count=${warnCount}`, `verify-pass=${String(report.pass)}`],
    priorityRecommendations,
    priorityLifecycleAudits,
    routeExecution,
    overrideNeeded,
    overrideType,
    overrideReason,
  };
}

export function buildSelfIterationRecord(input: {
  cycleId: string;
  state: WellState;
  report: VerifyReport;
  dryRunGate: DryRunReport["gateResult"];
}): SelfIterationRecord {
  const { cycleId, state, report, dryRunGate } = input;
  const stateHash = stableHash(JSON.stringify({
    drops: state.drops.map((drop: Drop) => [drop.dropId, drop.summary, drop.priority, drop.lifecycleState ?? "none"]),
    relations: state.relations.map((rel) => [rel.fromDropId, rel.toDropId, rel.relationType]),
    unresolved: state.unresolvedQuestions,
  }));

  return {
    cycleId,
    changedDropIds: [...report.changedDropIds],
    acceptanceCoverageDropIds: [...report.acceptanceCoverageDropIds],
    rerunConsistent: report.rerunConsistent,
    dryRunGate,
    verifyPass: report.pass,
    stateHash,
    createdAt: new Date().toISOString(),
  };
}
