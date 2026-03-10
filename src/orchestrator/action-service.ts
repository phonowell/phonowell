import { randomUUID } from "node:crypto";
import type {
  AcceptanceTraceLink,
  AssetDomain,
  AssetOwner,
  AssetScope,
  AssetSource,
  AssetType,
  ChangeProposal,
  Drop,
  MicroLifecycleSummary,
  Priority,
  Relation,
  RelationType,
  RunLog,
  Well,
  WellState,
} from "./types.js";
import { deriveUnresolvedQuestions } from "./conflict-service.js";
import {
  applyMicroLifecycle as applyMicroLifecycleToState,
  applyProposalToState,
  runHeuristicAnalyze as runHeuristicAnalyzeInState,
  runHeuristicGapCheck as runHeuristicGapCheckInState,
  runHeuristicOrganize as runHeuristicOrganizeInState,
} from "./graph-service.js";
import {
  connectDrops as connectDropsInState,
  ensureGoalOriginDraft as ensureGoalOriginDraftInState,
  ingestDrop as ingestDropInState,
  removeRelation as removeRelationInState,
  updateDrop as updateDropInState,
  updateGoalOrigin as updateGoalOriginInState,
  setAcceptanceTraceLinks as setAcceptanceTraceLinksInState,
  updateUnresolvedQuestions as updateUnresolvedQuestionsInState,
  updateWish,
} from "./state-edit-service.js";
import { refreshAcceptanceTraceLinks } from "./acceptance-traceability.js";
import { attachRunLogStateSummary } from "./run-log-state.js";

function nowIso(): string {
  return new Date().toISOString();
}

function makeRunLog(input: {
  stage: RunLog["stage"];
  status: RunLog["status"];
  summary: string;
  payload: Record<string, unknown>;
}): RunLog {
  return {
    runId: `run-${randomUUID().slice(0, 8)}`,
    stage: input.stage,
    status: input.status,
    summary: input.summary,
    payload: input.payload,
    createdAt: nowIso(),
  };
}

function appendChanged(target: string[], dropId?: string): void {
  if (!dropId) {
    return;
  }
  if (!target.includes(dropId)) {
    target.push(dropId);
  }
}

export interface ActionResult<T> {
  value: T;
  changedDropIds: string[];
  logs: RunLog[];
}

export function applyActionResult<T>(state: WellState, result: ActionResult<T>): T {
  for (const dropId of result.changedDropIds) {
    if (!state.pendingChangedDropIds.includes(dropId)) {
      state.pendingChangedDropIds.push(dropId);
    }
  }
  if (result.logs.length > 0) {
    const logs = result.logs.map((log) => ({
      ...log,
      payload: attachRunLogStateSummary(log.payload, state),
    }));
    state.runLogs.unshift(...[...logs].reverse());
    state.runLogs = state.runLogs.slice(0, 50);
  }
  return result.value;
}

export function ensureIntentHypothesisAction(state: WellState): ActionResult<{ hypothesisDropId?: string }> {
  state.well.status = "first-principles-modeling";
  const goal = state.drops.find((drop) => drop.type === "goal-origin");
  if (!goal) {
    return { value: {}, changedDropIds: [], logs: [] };
  }
  const hypothesisSummary = [
    `Objective: ${goal.summary}`,
    `Constraints: ${state.well.constraints.join(", ") || "none"}`,
    `Success: ${state.well.definitionOfDone.join("; ") || "unspecified"}`,
    "Non-goals: multi-artifact output, hidden-state decisions",
  ].join(" | ");

  const existing = state.drops.find((drop) => drop.type === "generated-intent-hypothesis");
  if (existing) {
    existing.summary = hypothesisSummary;
    existing.content = hypothesisSummary;
    existing.updatedAt = nowIso();
    existing.confidence = 0.91;
    refreshAcceptanceTraceLinks(existing, state);
    return {
      value: { hypothesisDropId: existing.dropId },
      changedDropIds: [existing.dropId],
      logs: [makeRunLog({
        stage: "modeling",
        status: "pass",
        summary: "intent.hypothesis.updated",
        payload: { hypothesisDropId: existing.dropId },
      })],
    };
  }

  const createdAt = nowIso();
  const created: Drop = {
    dropId: `drop-${randomUUID().slice(0, 8)}`,
    wellId: state.well.id,
    type: "generated-intent-hypothesis",
    domain: "protocol",
    scope: "run-local",
    source: "ai-generated",
    owner: "orchestrator-core",
    layer: "contract",
    title: "Intent Hypothesis",
    summary: hypothesisSummary,
    purpose: "Expose first-principles modeling output and uncertainty explicitly.",
    content: hypothesisSummary,
    priority: "p2",
    confidence: 0.91,
    licenseState: "known",
    lifecycleState: "candidate",
    parentDropId: goal.dropId,
    createdAt,
    updatedAt: createdAt,
  };
  state.drops.push(created);
  refreshAcceptanceTraceLinks(created, state);
  return {
    value: { hypothesisDropId: created.dropId },
    changedDropIds: [created.dropId],
    logs: [makeRunLog({
      stage: "modeling",
      status: "pass",
      summary: "intent.hypothesis.updated",
      payload: { hypothesisDropId: created.dropId },
    })],
  };
}

export function annotateConflictsAction(state: WellState): ActionResult<string[]> {
  state.well.status = "conflict-annotate";
  const questions = deriveUnresolvedQuestions({
    drops: state.drops,
    definitionOfDone: state.well.definitionOfDone,
    acceptanceDropId: state.well.acceptanceDropId,
  });
  state.unresolvedQuestions = questions;
  return {
    value: [...questions],
    changedDropIds: [],
    logs: [makeRunLog({
      stage: "conflict",
      status: questions.length ? "warn" : "pass",
      summary: "conflict.annotated",
      payload: { questions },
    })],
  };
}

export function setWishAction(state: WellState, input: { wish: string; definitionOfDone: string[]; constraints: string[] }): ActionResult<Well> {
  const well = updateWish(state, input);
  const changedDropIds: string[] = [];
  appendChanged(changedDropIds, state.well.originDropId);
  return {
    value: well,
    changedDropIds,
    logs: [makeRunLog({ stage: "intake", status: "pass", summary: "chat.intake.captured", payload: { wish: state.well.wish } })],
  };
}

export function ensureGoalOriginDraftAction(state: WellState): ActionResult<Drop> {
  const beforeId = state.well.originDropId;
  const goal = ensureGoalOriginDraftInState(state);
  const changedDropIds: string[] = [];
  if (!beforeId) {
    appendChanged(changedDropIds, goal.dropId);
  }
  return {
    value: goal,
    changedDropIds,
    logs: [makeRunLog({ stage: "dry-run", status: "warn", summary: "goal.origin.generated", payload: { goalDropId: goal.dropId } })],
  };
}

export function updateGoalOriginAction(
  state: WellState,
  input: { title?: string; summary?: string; status?: "draft" | "confirmed" | "revised" },
): ActionResult<Drop> {
  const goal = updateGoalOriginInState(state, input);
  return {
    value: goal,
    changedDropIds: [goal.dropId],
    logs: [],
  };
}

export function ingestDropAction(state: WellState, input: {
  type: AssetType;
  source: AssetSource;
  title: string;
  summary: string;
  content?: string;
  priority?: Priority;
  scope?: AssetScope;
  domain?: AssetDomain;
  owner?: AssetOwner;
  layer?: Drop["layer"];
  parentDropId?: string;
  x?: number;
  y?: number;
  skipAutoFlow?: boolean;
  preserveOrphan?: boolean;
}): ActionResult<Drop> {
  const drop = ingestDropInState(state, input);
  const changedDropIds = [drop.dropId];
  return {
    value: drop,
    changedDropIds,
    logs: input.skipAutoFlow
      ? []
      : [makeRunLog({ stage: "ingest", status: "pass", summary: "asset.dropped", payload: { dropId: drop.dropId } })],
  };
}

export function updateDropAction(
  state: WellState,
  dropId: string,
  input: Partial<Pick<Drop, "summary" | "title" | "position" | "domainId" | "clusterId" | "clusterLabel" | "frozenPlacement">> & { skipAutoFlow?: boolean },
): ActionResult<Drop> {
  const drop = updateDropInState(state, dropId, input);
  const changedSummaryOnly = !input.position && !input.domainId && !input.clusterId && input.frozenPlacement === undefined;
  return {
    value: drop,
    changedDropIds: [drop.dropId],
    logs: input.skipAutoFlow
      ? []
      : [makeRunLog({
        stage: input.position || input.domainId || input.clusterId ? "organize" : "analyze",
        status: "pass",
        summary: input.position
          ? "asset.position.edited"
          : changedSummaryOnly
            ? "asset.summary.edited"
            : "asset.structure.edited",
        payload: { dropId: drop.dropId },
      })],
  };
}

export function connectDropsAction(state: WellState, fromDropId: string, toDropId: string, relationType: RelationType = "references"): ActionResult<Relation> {
  const relation = connectDropsInState(state, fromDropId, toDropId, relationType);
  return {
    value: relation,
    changedDropIds: [fromDropId, toDropId],
    logs: [makeRunLog({
      stage: "organize",
      status: "pass",
      summary: "relation.connected",
      payload: { relationId: relation.relationId, fromDropId, toDropId, relationType },
    })],
  };
}

export function removeRelationAction(state: WellState, relationId: string): ActionResult<boolean> {
  const existing = state.relations.find((relation) => relation.relationId === relationId);
  const removed = removeRelationInState(state, relationId);
  return {
    value: removed,
    changedDropIds: removed
      ? [existing?.fromDropId, existing?.toDropId].filter((value): value is string => Boolean(value))
      : [],
    logs: removed
      ? [makeRunLog({ stage: "organize", status: "warn", summary: "relation.removed", payload: { relationId } })]
      : [],
  };
}

export function updateUnresolvedQuestionsAction(state: WellState, questions: string[]): ActionResult<string[]> {
  const next = updateUnresolvedQuestionsInState(state, questions);
  return {
    value: next,
    changedDropIds: [],
    logs: [makeRunLog({ stage: "conflict", status: next.length ? "warn" : "pass", summary: "unresolved.questions.updated", payload: { count: next.length } })],
  };
}

export function setAcceptanceTraceLinksAction(
  state: WellState,
  dropId: string,
  links: AcceptanceTraceLink[],
): ActionResult<Drop> {
  const drop = setAcceptanceTraceLinksInState(state, dropId, links);
  return {
    value: drop,
    changedDropIds: [drop.dropId],
    logs: [makeRunLog({
      stage: "analyze",
      status: "pass",
      summary: "acceptance.trace.updated",
      payload: { dropId, linkCount: links.length },
    })],
  };
}

export function runHeuristicAnalyzeAction(state: WellState): ActionResult<{ activeDropCount: number }> {
  const changedDropIds: string[] = [];
  runHeuristicAnalyzeInState(state, (dropId) => appendChanged(changedDropIds, dropId));
  return {
    value: { activeDropCount: state.drops.length },
    changedDropIds,
    logs: [makeRunLog({
      stage: "analyze",
      status: "pass",
      summary: "analyze.completed",
      payload: { activeDropCount: state.drops.length },
    })],
  };
}

export function runHeuristicOrganizeAction(state: WellState): ActionResult<{ relationCount: number }> {
  runHeuristicOrganizeInState(state);
  return {
    value: { relationCount: state.relations.length },
    changedDropIds: [],
    logs: [makeRunLog({
      stage: "organize",
      status: "pass",
      summary: "organize.completed",
      payload: { relationCount: state.relations.length },
    })],
  };
}

export function runHeuristicGapCheckAction(state: WellState): ActionResult<{ createdGapDropId?: string }> {
  const changedDropIds: string[] = [];
  const result = runHeuristicGapCheckInState(state, (dropId) => appendChanged(changedDropIds, dropId));
  return {
    value: result,
    changedDropIds,
    logs: [makeRunLog({
      stage: "gap-fill",
      status: result.createdGapDropId ? "warn" : "pass",
      summary: result.createdGapDropId ? "gap-fill.generated" : "gap-check.completed",
      payload: result.createdGapDropId ? { dropId: result.createdGapDropId } : { gapFilled: false },
    })],
  };
}

export function applyProposalAction(state: WellState, proposal: ChangeProposal): ActionResult<ChangeProposal> {
  if (proposal.status === "applied") {
    return { value: proposal, changedDropIds: [], logs: [] };
  }
  if (proposal.gateStatus === "fail") {
    throw new Error(`proposal blocked by gate: ${proposal.gateReasons.join("; ") || "unknown reason"}`);
  }
  const changedDropIds: string[] = [];
  const result = applyProposalToState({
    state,
    proposal,
    markChanged: (dropId) => appendChanged(changedDropIds, dropId),
    removeRelation: (relationId) => removeRelationInState(state, relationId),
  });
  proposal.status = "applied";
  proposal.appliedAt = nowIso();
  return {
    value: proposal,
    changedDropIds,
    logs: [makeRunLog({
      stage: "organize",
      status: result.appliedAssetPatchCount + result.appliedRelationPatchCount + result.appliedDomainPatchCount > 0 ? "pass" : "warn",
      summary: "proposal.applied",
      payload: {
        proposalId: proposal.proposalId,
        appliedAssetPatchCount: result.appliedAssetPatchCount,
        appliedRelationPatchCount: result.appliedRelationPatchCount,
        appliedDomainPatchCount: result.appliedDomainPatchCount,
        gateStatus: proposal.gateStatus,
        changedDropIds: result.changedDropIds,
      },
    })],
  };
}

export function applyMicroLifecycleAction(state: WellState): ActionResult<MicroLifecycleSummary> {
  const summary = applyMicroLifecycleToState(state);
  return {
    value: summary,
    changedDropIds: [],
    logs: [makeRunLog({ stage: "verify", status: "warn", summary: "micro-lifecycle-updated", payload: summary as unknown as Record<string, unknown> })],
  };
}
