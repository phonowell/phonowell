import { buildCoverageReport } from "./coverage.js";
import type { DryRunReport, WellState } from "./types.js";
import { PhonoWellEngine } from "./engine.js";
import { getSchemaManifest, getSchemaValidationReport } from "./validator.js";
import { runClosureScenario } from "./scenario-service.js";
import { isVerifyReportReadyForAcceptance, listVerifyCoverageGaps } from "./verification-service.js";

export interface CoreGateCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  evidence: string[];
}

export interface CoreGateResult {
  gateResult: "pass" | "warn" | "fail";
  summary: {
    passCount: number;
    warnCount: number;
    failCount: number;
    total: number;
  };
  checks: CoreGateCheck[];
  dryRun: DryRunReport | null;
  latestVerifyCycle: WellState["verifyCycles"][number] | null;
  latestSelfIterationRecord: WellState["selfIterationRecords"][number] | null;
}

function gate(name: string, status: "pass" | "warn" | "fail", evidence: string[]): CoreGateCheck {
  return { name, status, evidence };
}

export function evaluateCoreGate(state: WellState, catalog: ReturnType<PhonoWellEngine["getCatalog"]>): CoreGateResult {
  const coverage = buildCoverageReport(catalog, state);
  const schemaValidation = getSchemaValidationReport(state, catalog);
  const checks: CoreGateCheck[] = [];
  const latestVerify = state.verifyReports[0];
  const latestVerifyCycle = state.verifyCycles[0];
  const latestSelfIteration = state.selfIterationRecords[0];
  const coverageReady = latestVerify ? listVerifyCoverageGaps(latestVerify).length === 0 : false;
  const verifyReady = latestVerify ? isVerifyReportReadyForAcceptance(latestVerify) : false;

  checks.push(gate("core-foundation.one-well-one-artifact", state.well.artifactType ? "pass" : "fail", [
    `well-id=${state.well.id}`,
    `artifact-type=${state.well.artifactType}`,
  ]));

  const goal = state.drops.find((drop) => drop.type === "goal-origin");
  checks.push(gate("core-foundation.goal-origin", goal ? "pass" : "fail", [
    goal ? `goal-drop=${goal.dropId}` : "goal-drop missing",
    `goal-status=${goal?.goalStatus ?? "none"}`,
  ]));

  const hypothesis = state.drops.find((drop) => drop.type === "generated-intent-hypothesis");
  checks.push(gate("core-foundation.first-principles", hypothesis ? "pass" : "warn", [
    hypothesis ? `hypothesis-drop=${hypothesis.dropId}` : "hypothesis missing",
  ]));

  checks.push(gate("acceptance-contract.binding", state.well.acceptanceDropId ? "pass" : "fail", [
    `acceptance-drop-id=${state.well.acceptanceDropId || "none"}`,
  ]));

  checks.push(gate("acceptance-contract.coverage-evidence", coverageReady ? "pass" : "fail", [
    `verify-present=${String(Boolean(latestVerify))}`,
    `verify-pass=${String(latestVerify?.pass ?? false)}`,
    `coverage-count=${latestVerify?.acceptanceCoverageDropIds?.length ?? 0}`,
    `uncovered-items=${latestVerify?.uncoveredAcceptanceItemIds?.length ?? 0}`,
  ]));

  checks.push(gate("acceptance-contract.self-iteration", latestSelfIteration?.verifyPass === true && latestSelfIteration?.rerunConsistent === true ? "pass" : "fail", [
    `self-iteration-records=${state.selfIterationRecords.length}`,
    `verify-pass=${latestSelfIteration?.verifyPass ?? false}`,
    `rerun-consistent=${latestSelfIteration?.rerunConsistent ?? false}`,
  ]));

  const dry = state.well.dryRunReport ?? null;
  checks.push(gate("execution-protocol.preflight", dry ? (dry.gateResult === "fail" ? "fail" : dry.gateResult) : "warn", [
    `dry-run-present=${String(Boolean(dry))}`,
    `dry-run-gate=${dry?.gateResult ?? "none"}`,
    `check-total=${dry?.checkTotal ?? 0}`,
  ]));

  checks.push(gate(
    "execution-protocol.organize-evidence",
    state.packetRecords.some((packet) => packet.stage === "analyze" || packet.stage === "gap-fill") ? "pass" : "warn",
    [
      `analyze-packets=${state.packetRecords.filter((packet) => packet.stage === "analyze").length}`,
      `gap-fill-packets=${state.packetRecords.filter((packet) => packet.stage === "gap-fill").length}`,
    ],
  ));

  checks.push(gate("execution-protocol.main-loop", state.candidates.length > 0 && verifyReady && state.pendingChangedDropIds.length === 0 ? "pass" : "fail", [
    `candidate-count=${state.candidates.length}`,
    `verify-count=${state.verifyReports.length}`,
    `pending-changed=${state.pendingChangedDropIds.length}`,
  ]));

  const schemaManifest = getSchemaManifest();
  const dataFormatAsset = state.drops.find((drop) => drop.dropId === "drop-canon-data-format-contract");
  const formatFieldsValid = state.drops.every((drop) => Boolean(drop.owner && drop.type && drop.domain && drop.scope && drop.source));
  checks.push(gate("data-format-contract.standard-shape", dataFormatAsset && formatFieldsValid ? "pass" : "fail", [
    `data-format-asset=${dataFormatAsset ? dataFormatAsset.dropId : "missing"}`,
    `drop-format-valid=${formatFieldsValid}`,
  ]));

  checks.push(gate("data-format-contract.schema-manifest", schemaManifest.assetSchemaId && schemaManifest.stateSchemaId ? "pass" : "fail", [
    `asset-schema=${schemaManifest.assetSchemaId}`,
    `state-schema=${schemaManifest.stateSchemaId}`,
  ]));

  checks.push(gate("data-format-contract.schema-validation", schemaValidation.pass ? "pass" : "fail", [
    `schema-validation-pass=${schemaValidation.pass}`,
    `schema-issue-count=${schemaValidation.issueCount}`,
  ]));

  const latestPacket = state.packetRecords[0];
  const latestProposal = state.proposals[0];
  checks.push(gate(
    "execution-protocol.patch-quality",
    latestPacket?.response.structured?.summary ? "pass" : "warn",
    [
      `latest-packet-stage=${latestPacket?.stage ?? "none"}`,
      `structured-summary=${latestPacket?.response.structured?.summary ? "present" : "missing"}`,
      `proposal-status=${latestProposal?.status ?? "none"}`,
    ],
  ));

  checks.push(gate("execution-protocol.proposal-governance", latestProposal ? "pass" : "warn", [
    `latest-proposal=${latestProposal?.proposalId ?? "none"}`,
    `proposal-stage=${latestProposal?.stage ?? "none"}`,
    `proposal-status=${latestProposal?.status ?? "none"}`,
  ]));

  checks.push(gate("execution-protocol.verify-routing", latestVerifyCycle?.routeExecution?.executed && latestVerifyCycle.routeExecution.status === "pass" && !latestVerifyCycle.overrideNeeded ? "pass" : "fail", [
    `verify-cycles=${state.verifyCycles.length}`,
    `latest-route=${latestVerifyCycle?.verifyRoute ?? "none"}`,
    `route-status=${latestVerifyCycle?.routeExecution?.status ?? "none"}`,
    `override-needed=${latestVerifyCycle?.overrideNeeded ?? false}`,
  ]));

  checks.push(gate("execution-protocol.priority-lifecycle", latestVerifyCycle && !latestVerifyCycle.priorityLifecycleAudits?.some((audit) => audit.overrideRequired) ? "pass" : "fail", [
    `priority-change-count=${latestVerifyCycle?.priorityRecommendations?.length ?? 0}`,
    `override-required-count=${latestVerifyCycle?.priorityLifecycleAudits?.filter((audit) => audit.overrideRequired).length ?? 0}`,
  ]));

  checks.push(gate("coverage.active-assets", coverage.summary.missing === 0 ? "pass" : "fail", [
    `coverage-implemented=${coverage.summary.implemented}`,
    `coverage-missing=${coverage.summary.missing}`,
  ]));

  const passCount = checks.filter((check) => check.status === "pass").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  const failCount = checks.filter((check) => check.status === "fail").length;

  return {
    gateResult: failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass",
    summary: {
      passCount,
      warnCount,
      failCount,
      total: checks.length,
    },
    checks,
    dryRun: dry,
    latestVerifyCycle: state.verifyCycles[0] ?? null,
    latestSelfIterationRecord: state.selfIterationRecords[0] ?? null,
  };
}

export async function runCoreGateScenario(engine: PhonoWellEngine): Promise<CoreGateResult> {
  await runClosureScenario(engine, "core-gate.scenario");
  return evaluateCoreGate(engine.getState(), engine.getCatalog());
}
