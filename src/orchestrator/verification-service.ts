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

export function buildVerifyReport(input: {
  state: WellState;
  packetId: string;
  dryRunReport: DryRunReport;
}): VerifyReport {
  const { state, packetId, dryRunReport } = input;
  const issues: string[] = [];
  const suggestions: string[] = [];
  const changedDropIds = [...state.pendingChangedDropIds];
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
  const rerunConsistent = lastRecord ? lastRecord.stateHash === currentStateHash : true;

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
  const p0Drops = state.drops.filter((drop) => drop.priority === "p0");
  const promotedToP0 = priorityRecommendations.filter((change) => change.to === "p0").length;
  const repeatedRoute = state.verifyCycles
    .slice(0, 1)
    .some((cycle) => cycle.verifyRoute === verifyRoute && (failCount + warnCount) >= 1);
  const bypassViolation = state.well.dryRunReport?.gateResult === "fail" && verifyRoute === "regenerate";
  const overrideNeeded = !report.pass && (p0Drops.length > 2 || promotedToP0 > 2 || repeatedRoute || bypassViolation);

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
      : "More than 2 p0 drops in a failing verify cycle.";
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
