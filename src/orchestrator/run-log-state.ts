import type { RunLogStateSummary, WellState } from "./types.js";

export const RUN_LOG_STATE_SUMMARY_KEY = "__phonowellRunStateSummary";

export function buildRunLogStateSummary(state: WellState): RunLogStateSummary {
  return {
    wellStatus: state.well.status,
    dryRunStatus: state.well.dryRunStatus,
    acceptanceStatus: state.well.acceptanceStatus,
    pendingChangedDropCount: state.pendingChangedDropIds.length,
    unresolvedQuestionCount: state.unresolvedQuestions.length,
    automationTaskCount: state.automationTasks.length,
    latestCandidateId: state.candidates[0]?.candidateId,
    latestVerifyPass: state.verifyReports[0]?.pass,
    assistantLoopStatus: state.assistantLoop.status,
    assistantLoopUserState: state.assistantLoop.userState,
  };
}

export function attachRunLogStateSummary(
  payload: Record<string, unknown>,
  state: WellState,
): Record<string, unknown> {
  return {
    ...payload,
    [RUN_LOG_STATE_SUMMARY_KEY]: buildRunLogStateSummary(state),
  };
}

export function extractRunLogStateSummary(payload: Record<string, unknown>): RunLogStateSummary | undefined {
  const value = payload[RUN_LOG_STATE_SUMMARY_KEY];
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const summary = value as Partial<RunLogStateSummary>;
  if (
    typeof summary.wellStatus !== "string"
    || typeof summary.dryRunStatus !== "string"
    || typeof summary.acceptanceStatus !== "string"
    || typeof summary.pendingChangedDropCount !== "number"
    || typeof summary.unresolvedQuestionCount !== "number"
    || typeof summary.automationTaskCount !== "number"
    || typeof summary.assistantLoopStatus !== "string"
    || typeof summary.assistantLoopUserState !== "string"
  ) {
    return undefined;
  }
  return {
    wellStatus: summary.wellStatus,
    dryRunStatus: summary.dryRunStatus,
    acceptanceStatus: summary.acceptanceStatus,
    pendingChangedDropCount: summary.pendingChangedDropCount,
    unresolvedQuestionCount: summary.unresolvedQuestionCount,
    automationTaskCount: summary.automationTaskCount,
    latestCandidateId: typeof summary.latestCandidateId === "string" ? summary.latestCandidateId : undefined,
    latestVerifyPass: typeof summary.latestVerifyPass === "boolean" ? summary.latestVerifyPass : undefined,
    assistantLoopStatus: summary.assistantLoopStatus,
    assistantLoopUserState: summary.assistantLoopUserState,
  };
}

export function stripRunLogStateSummary(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  delete next[RUN_LOG_STATE_SUMMARY_KEY];
  return next;
}
