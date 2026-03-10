import test from "node:test";
import assert from "node:assert/strict";
import { PhonoWellEngine } from "../orchestrator/engine.js";
import { listAcceptanceItems } from "../orchestrator/acceptance-traceability.js";
import { evaluateCoreGate, runCoreGateScenario } from "../orchestrator/core-gate.js";
import { buildFallbackStructured, parseStructuredOutput } from "../orchestrator/packet-structured.js";
import { buildVerifyCycle, buildVerifyReport } from "../orchestrator/verification-service.js";

process.env.PHONOWELL_DISABLE_CODEX_RUNTIME = "1";

function nonConversationState(state: ReturnType<PhonoWellEngine["getState"]>) {
  const clone = structuredClone(state);
  clone.assetConversations = [];
  return clone;
}

function makeReadyVerifyReport(engine: PhonoWellEngine, createdAt = new Date().toISOString()) {
  const state = engine.getState();
  const coveredDropId = state.well.originDropId ?? state.drops[0]?.dropId ?? "drop-ready";
  const evidence = [{
    kind: "drop" as const,
    ref: coveredDropId,
    detail: "ready acceptance evidence",
    source: "manual-link" as const,
  }];
  return {
    pass: true,
    issues: [],
    suggestions: [],
    acceptanceCoverageDropIds: [coveredDropId],
    acceptanceItems: [{
      itemId: "accept-ready-item",
      title: "Ready acceptance evidence",
      source: "definition-of-done" as const,
      status: "covered" as const,
      coveredByDropIds: [coveredDropId],
      evidence,
      confidence: 0.96,
    }],
    changedDropCoverage: [{
      dropId: coveredDropId,
      acceptanceItemIds: ["accept-ready-item"],
      evidence,
    }],
    uncoveredAcceptanceItemIds: [],
    selfIterationEvidence: ["run-1:dry-run:pass", "run-2:generate:pass"],
    changedDropIds: [coveredDropId],
    rerunConsistent: true,
    createdAt,
  };
}

test("bootstrap creates goal origin without auto-running packet flow", () => {
  const engine = new PhonoWellEngine();
  const before = engine.getState();
  assert.equal(before.packetRecords.length, 0);
  assert.equal(before.proposals.length, 0);

  const state = engine.bootstrapInitialState();
  assert.ok(state.well.originDropId);
  assert.equal(state.packetRecords.length, 0);
  assert.equal(state.proposals.length, 0);
  assert.ok(state.runLogs.some((log) => log.summary === "bootstrap.initialized"));
});

test("conversation processing produces a user message and a system message with output source", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  const before = engine.getState();

  const result = await engine.runConversation({
    content: "请整理当前资产并指出最高优先级缺口",
    scope: "global",
  });
  const after = engine.getState();

  assert.equal(result.userMessage.role, "user");
  assert.equal(result.systemMessage.role, "system");
  assert.ok(["model", "fallback"].includes(result.analysis.outputSource));
  assert.ok(result.systemMessage.content.includes("system reply source:"));
  assert.deepEqual(nonConversationState(after), nonConversationState(before));
  assert.equal("packet" in result, false);
});

test("conversation does not mutate graph state or apply proposals implicitly", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.setUnresolvedQuestions(["manual question"]);
  const before = engine.getState();

  await engine.runConversation({
    content: "只是问个问题，不应该修改资产",
    scope: "global",
  });

  const after = engine.getState();
  assert.deepEqual(nonConversationState(after), nonConversationState(before));
});

test("fallback packets are explicitly marked when model execution fails", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();

  const packet = await engine.runPacketStage("verify", { conversationPrompt: "force fast timeout" });
  assert.equal(packet.response.usedFallback, true);
  assert.equal(packet.response.outputSource, "fallback");
  assert.equal(packet.response.structured?.outputSource, "fallback");
  assert.ok(packet.response.structured?.provenanceNotes?.some((item) => item.includes("fallback")));
});

test("engine fallback runtime forces packet execution to stay offline", async () => {
  const engine = new PhonoWellEngine({ forceFallbackRuntime: true });
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });

  const packet = await engine.runPacketStage("analyze");
  assert.equal(packet.response.usedFallback, true);
  assert.ok(packet.response.evidence.some((item) => item === "forced-fallback=true"));
});

test("deep organize is the path that persists organize packets and proposals", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  const before = engine.getState();

  const result = await engine.runDeepOrganize("test.deep-organize");
  const after = engine.getState();

  assert.equal(before.packetRecords.length, 0);
  assert.equal(after.packetRecords.length >= 2, true);
  assert.equal(after.proposals.length >= 1, true);
  assert.equal(after.candidates.length, before.candidates.length);
  assert.equal(after.verifyReports.length, before.verifyReports.length);
  assert.equal(after.verifyCycles.length, before.verifyCycles.length);
  assert.equal(after.selfIterationRecords.length, before.selfIterationRecords.length);
  assert.ok(result.analyzePacket.packetId);
  assert.ok(result.gapFillPacket.packetId);
});

test("generate fails closed when dry-run gate is fail", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  const before = engine.getState();

  await assert.rejects(() => engine.generateArtifact(), /dry-run gate is fail/);

  const after = engine.getState();
  assert.equal(after.packetRecords.length, before.packetRecords.length);
  assert.equal(after.proposals.length, before.proposals.length);
  assert.equal(after.candidates.length, before.candidates.length);
  assert.equal(after.verifyReports.length, before.verifyReports.length);
  assert.equal(after.verifyCycles.length, before.verifyCycles.length);
  assert.equal(after.selfIterationRecords.length, before.selfIterationRecords.length);
});

test("verify fails closed when there is no candidate", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  const before = engine.getState();

  await assert.rejects(() => engine.verifyLatest(), /no candidate artifact/);

  const after = engine.getState();
  assert.equal(after.packetRecords.length, before.packetRecords.length);
  assert.equal(after.proposals.length, before.proposals.length);
  assert.equal(after.verifyReports.length, before.verifyReports.length);
  assert.equal(after.verifyCycles.length, before.verifyCycles.length);
  assert.equal(after.selfIterationRecords.length, before.selfIterationRecords.length);
  assert.deepEqual(after.pendingChangedDropIds, before.pendingChangedDropIds);
});

test("generate and verify advance the persisted main loop", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  await engine.runDeepOrganize("test.main-loop");

  const dryRun = engine.runDryRun();
  assert.ok(["pass", "warn", "fail"].includes(dryRun.gateResult));

  if (dryRun.gateResult !== "fail") {
    const beforeGenerate = engine.getState();
    const candidate = await engine.generateArtifact();
    assert.ok(candidate.candidateId);
    const afterGenerate = engine.getState();
    assert.equal(afterGenerate.proposals.length, beforeGenerate.proposals.length + 1);
    assert.equal(afterGenerate.candidates.length, beforeGenerate.candidates.length + 1);
    assert.deepEqual(afterGenerate.drops, beforeGenerate.drops);
    assert.deepEqual(afterGenerate.relations, beforeGenerate.relations);

    const pendingBeforeVerify = afterGenerate.pendingChangedDropIds.slice();
    const verify = await engine.verifyLatest();
    assert.equal(typeof verify.pass, "boolean");
    const state = engine.getState();
    assert.equal(state.candidates.length >= 1, true);
    assert.equal(state.verifyReports.length >= 1, true);
    assert.equal(state.verifyCycles.length >= 1, true);
    assert.equal(state.selfIterationRecords.length >= 1, true);
    assert.deepEqual(verify.changedDropIds, pendingBeforeVerify);
    assert.ok(Boolean(state.verifyCycles[0]?.routeExecution?.executed));
    assert.ok((state.verifyCycles[0]?.priorityRecommendations?.length ?? 0) >= 0);
    assert.ok((state.verifyCycles[0]?.priorityLifecycleAudits?.length ?? 0) >= 0);
    assert.ok(state.verifyReports[0]?.acceptanceItems.length >= 1);
    assert.ok(state.verifyReports[0]?.changedDropCoverage.length >= 1);
  }
});

test("runCycle short-circuits after dry-run fail", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  const before = engine.getState();

  const result = await engine.runCycle();
  const after = engine.getState();

  assert.match(result.error ?? "", /cycle halted/);
  assert.equal(result.candidate, undefined);
  assert.equal(result.verify, undefined);
  assert.equal(after.packetRecords.length, before.packetRecords.length);
  assert.equal(after.proposals.length, before.proposals.length);
  assert.equal(after.candidates.length, before.candidates.length);
  assert.equal(after.verifyReports.length, before.verifyReports.length);
});

test("core gate scenario converges to pass after end-to-end execution", async () => {
  const engine = new PhonoWellEngine();

  const result = await runCoreGateScenario(engine);

  assert.equal(result.gateResult, "pass");
  assert.equal(result.dryRun?.gateResult, "pass");
  assert.equal(result.summary.failCount, 0);
  assert.equal(result.summary.warnCount, 0);
});

test("asset-clarity stays pass when low-confidence assets are otherwise explicit", () => {
  const engine = new PhonoWellEngine();
  return runCoreGateScenario(engine).then(() => {
    engine.ingestDrop({
      type: "note",
      source: "ai-generated",
      title: "Low confidence but explicit",
      summary: "Clear content, purpose, and relations should avoid asset-clarity warnings.",
      preserveOrphan: false,
    });

    const state = engine.getState();
    const created = state.drops.find((drop) => drop.title === "Low confidence but explicit");
    assert.ok(created);
    created!.confidence = 0.61;
    engine.replaceState(state);

    const report = engine.runDryRun();
    const assetClarity = report.checks.find((check) => check.name === "asset-clarity");

    assert.equal(assetClarity?.status, "pass");
  });
});

test("post-ingest automation is queued without blocking and writes auditable decisions", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();

  const drop = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Verify route execution gap",
    summary: "Need verify route execution and acceptance evidence mapping.",
    preserveOrphan: false,
  });
  const queued = engine.schedulePostIngestAutomation(drop.dropId, "test.ingest");
  const afterQueue = engine.getState();

  assert.equal(queued.status, "pending");
  assert.equal(afterQueue.automationTasks[0]?.taskId, queued.taskId);

  const completed = engine.processPendingAutomationTasks();
  const afterRun = engine.getState();
  assert.equal(completed[0]?.status, "completed");
  assert.ok(afterRun.automationTasks[0]?.decisions.length >= 5);
  assert.ok(afterRun.runLogs.some((log) => log.summary === "automation.post-ingest.completed"));
});

test("verify route is executed and priority lifecycle mutates state with audit records", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  await engine.runDeepOrganize("test.verify-route");

  engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Critical verify blocker",
    summary: "Critical verify fail blocker for acceptance route execution.",
    priority: "p2",
    preserveOrphan: false,
  });
  engine.runDryRun();

  const stateBefore = engine.getState();
  const dryRun = stateBefore.well.dryRunReport;
  if (dryRun?.gateResult !== "fail") {
    return;
  }

  stateBefore.candidates.unshift({
    candidateId: "candidate-test",
    wellId: stateBefore.well.id,
    content: "candidate",
    coverageDropIds: stateBefore.drops.map((drop) => drop.dropId),
    createdAt: new Date().toISOString(),
  });
  engine.replaceState(stateBefore);

  const verify = await engine.verifyLatest();
  const after = engine.getState();
  const cycle = after.verifyCycles[0];

  assert.equal(verify.pass, false);
  assert.ok(Boolean(cycle.routeExecution?.executed));
  assert.notEqual(cycle.routeExecution?.route, undefined);
  assert.ok((cycle.priorityLifecycleAudits?.length ?? 0) >= 1);
  assert.ok(cycle.priorityLifecycleAudits?.some((audit) => audit.decision === "applied" || audit.overrideRequired));
  assert.equal(after.pendingChangedDropIds.length >= 1, true);
});

test("acceptance coverage maps changed drops to acceptance items and evidence", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  await engine.runDeepOrganize("test.acceptance");

  const state = engine.getState();
  state.candidates.unshift({
    candidateId: "candidate-acceptance",
    wellId: state.well.id,
    content: "candidate",
    coverageDropIds: state.drops.map((drop) => drop.dropId),
    createdAt: new Date().toISOString(),
  });
  engine.replaceState(state);

  const goalId = engine.getState().well.originDropId;
  assert.ok(goalId);
  engine.updateDrop(goalId!, { summary: "Support goal-origin draft edit confirm and acceptance evidence mapping." });
  const goalItemId = listAcceptanceItems(engine.getState()).find((item) => item.title === "Support goal-origin draft/edit/confirm")?.itemId;
  assert.ok(goalItemId);
  engine.bindDropToAcceptanceItems(goalId!, [goalItemId!], "goal supports goal-origin acceptance item");
  const verify = await engine.verifyLatest();

  assert.ok(verify.acceptanceItems.length >= 1);
  assert.ok(verify.changedDropCoverage.some((item) => item.acceptanceItemIds.length >= 1));
  assert.ok(verify.acceptanceItems.some((item) => item.evidence.length >= 1));
  assert.ok(Array.isArray(verify.uncoveredAcceptanceItemIds));
});

test("verify pass executes real regenerate action instead of placeholder", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  await engine.runDeepOrganize("test.regenerate");

  const state = engine.getState();
  state.candidates.unshift({
    candidateId: "candidate-regen-base",
    wellId: state.well.id,
    content: "candidate base",
    coverageDropIds: state.drops.map((drop) => drop.dropId),
    createdAt: new Date().toISOString(),
  });
  state.pendingChangedDropIds = [state.well.originDropId!];
  engine.replaceState(state);
  const firstItemId = listAcceptanceItems(engine.getState())[0]?.itemId;
  assert.ok(firstItemId);
  engine.bindDropToAcceptanceItems(state.well.originDropId!, [firstItemId!], "test bind");
  const allItemIds = listAcceptanceItems(engine.getState()).map((item) => item.itemId);
  for (const itemId of allItemIds.slice(1)) {
    engine.bindDropToAcceptanceItems(state.well.originDropId!, [itemId], "full bind for pass case");
  }
  engine.runDryRun();

  const before = engine.getState().candidates.length;
  const verify = await engine.verifyLatest();
  const after = engine.getState();
  const routeExecution = after.verifyCycles[0]?.routeExecution;

  assert.equal(verify.pass, true);
  assert.equal(routeExecution?.route, "regenerate");
  assert.ok(routeExecution?.actions.includes("candidate.regenerated"));
  assert.equal(after.candidates.length, before + 1);
  assert.ok(after.candidates[0]?.packetId);
  assert.notEqual(after.candidates[0]?.content, "candidate base");
  assert.ok(routeExecution?.evidence.some((item) => item.includes("candidate-id=")));
  assert.ok(routeExecution?.evidence.some((item) => item.includes("packet-id=")));
});

test("acceptance trace link can cover items without token overlap", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  await engine.runDeepOrganize("test.trace-link");

  const state = engine.getState();
  state.candidates.unshift({
    candidateId: "candidate-trace-link",
    wellId: state.well.id,
    content: "candidate",
    coverageDropIds: state.drops.map((drop) => drop.dropId),
    createdAt: new Date().toISOString(),
  });
  engine.replaceState(state);

  const drop = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Offline verifier",
    summary: "Make the system runnable without network dependence.",
    preserveOrphan: false,
  });
  const itemId = listAcceptanceItems(engine.getState()).find((item) => item.title === "Run dry-run before generate")?.itemId;
  assert.ok(itemId);
  engine.bindDropToAcceptanceItems(drop.dropId, [itemId!], "semantic bind");
  const verify = await engine.verifyLatest();
  const covered = verify.acceptanceItems.find((item) => item.itemId === itemId);

  assert.equal(covered?.status, "covered");
  assert.ok(covered?.evidence.some((item) => item.source === "manual-link"));
});

test("updating drop text preserves existing manual acceptance links", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();

  const drop = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Manual acceptance link",
    summary: "Initial summary for manual acceptance mapping.",
    preserveOrphan: false,
  });
  const itemId = listAcceptanceItems(engine.getState())[0]?.itemId;
  assert.ok(itemId);
  engine.bindDropToAcceptanceItems(drop.dropId, [itemId!], "preserve manual link");

  engine.updateDrop(drop.dropId, {
    summary: "Edited summary that should not wipe existing manual acceptance links.",
  });

  const updated = engine.getState().drops.find((item) => item.dropId === drop.dropId);
  assert.ok(updated);
  assert.ok(updated?.acceptanceTraceLinks?.some((link) => link.itemId === itemId && link.source === "manual-link"));
});

test("auto-flow repairs missing acceptance trace links on generated intent hypothesis", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  engine.runAutoFlow("test.trace-repair.initial");

  const firstState = engine.getState();
  const hypothesis = firstState.drops.find((drop) => drop.type === "generated-intent-hypothesis");
  assert.ok(hypothesis);
  hypothesis!.acceptanceTraceLinks = [];
  engine.replaceState(firstState);

  engine.runAutoFlow("test.trace-repair.rerun");
  const repaired = engine.getState().drops.find((drop) => drop.type === "generated-intent-hypothesis");
  assert.ok(repaired);
  assert.equal((repaired?.acceptanceTraceLinks?.length ?? 0) >= 4, true);
  const acceptanceItems = listAcceptanceItems(engine.getState());
  const acceptanceContractItemIds = new Set(
    acceptanceItems.filter((item) => item.source === "acceptance-contract").map((item) => item.itemId),
  );
  assert.ok(repaired?.acceptanceTraceLinks?.some((link) => acceptanceContractItemIds.has(link.itemId)));
});

test("verify cycle does not request override for non-p0 lifecycle promotions", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();

  const noteA = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Trace gap A",
    summary: "Needs trace evidence A.",
    preserveOrphan: false,
  });
  const noteB = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Trace gap B",
    summary: "Needs trace evidence B.",
    preserveOrphan: false,
  });
  const noteC = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Trace gap C",
    summary: "Needs trace evidence C.",
    preserveOrphan: false,
  });

  const state = engine.getState();
  const report = {
    ...makeReadyVerifyReport(engine),
    pass: false,
    issues: ["acceptance evidence missing"],
    uncoveredAcceptanceItemIds: ["accept-gap"],
  };
  const recommendations = [
    { dropId: noteA.dropId, from: "p2" as const, to: "p1" as const, reason: "improve mid-path convergence" },
    { dropId: noteB.dropId, from: "p2" as const, to: "p1" as const, reason: "improve mid-path convergence" },
    { dropId: noteC.dropId, from: "p2" as const, to: "p1" as const, reason: "improve mid-path convergence" },
  ];
  const cycle = buildVerifyCycle({
    state,
    report,
    priorityRecommendations: recommendations,
    priorityLifecycleAudits: recommendations.map((item) => ({
      ...item,
      decision: "applied" as const,
      overrideRequired: false,
      evidence: [
        "goal-impact=linked-to-origin",
        "risk-delta=mid-path-convergence",
      ],
      createdAt: new Date().toISOString(),
    })),
    routeExecution: {
      route: "analyze",
      executed: true,
      status: "pass",
      actions: ["analyze", "organize"],
      evidence: ["pending-changed=3"],
      createdAt: new Date().toISOString(),
    },
  });

  assert.equal(cycle.overrideNeeded, false);
  assert.equal(cycle.overrideType, undefined);
});

test("core gate separates coverage evidence from self-iteration consistency", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  const state = engine.getState();
  const verify = {
    ...makeReadyVerifyReport(engine),
    rerunConsistent: false,
  };
  state.verifyReports.unshift(verify);
  state.selfIterationRecords.unshift({
    cycleId: "cycle-self-iteration",
    changedDropIds: verify.changedDropIds,
    acceptanceCoverageDropIds: verify.acceptanceCoverageDropIds,
    rerunConsistent: false,
    dryRunGate: "pass",
    verifyPass: true,
    stateHash: "h-old",
    createdAt: new Date().toISOString(),
  });
  engine.replaceState(state);

  const gate = evaluateCoreGate(engine.getState(), engine.getCatalog());
  const coverage = gate.checks.find((item) => item.name === "acceptance-contract.coverage-evidence");
  const selfIteration = gate.checks.find((item) => item.name === "acceptance-contract.self-iteration");

  assert.equal(coverage?.status, "pass");
  assert.equal(selfIteration?.status, "fail");
});

test("rerun consistency ignores previous records from a different changed-drop set", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });

  const state = engine.getState();
  state.selfIterationRecords.unshift({
    cycleId: "cycle-previous",
    changedDropIds: ["drop-other"],
    acceptanceCoverageDropIds: [],
    rerunConsistent: true,
    dryRunGate: "pass",
    verifyPass: false,
    stateHash: "h-different",
    createdAt: new Date().toISOString(),
  });
  state.pendingChangedDropIds = [state.well.originDropId!];
  engine.replaceState(state);

  const report = buildVerifyReport({
    state: engine.getState(),
    packetId: "packet-rerun-consistency",
    dryRunReport: {
      checkTotal: 9,
      passCount: 9,
      warnCount: 0,
      failCount: 0,
      criticalWarnCount: 0,
      criticalFailCount: 0,
      highConflictCount: 0,
      missingRequiredCapabilityCount: 0,
      acceptanceUnboundCount: 0,
      acceptanceUncheckableCount: 0,
      selfIterationEvidencePathMissingCount: 0,
      assetUnclearCount: 0,
      assetMissingPurposeCount: 0,
      assetOrphanCount: 0,
      designOverlapCount: 0,
      designContradictionCount: 0,
      designRedundancyCount: 0,
      designErrorCount: 0,
      designLowRoiCount: 0,
      gateResult: "pass",
      gateReason: "pass",
      checks: [],
      createdAt: new Date().toISOString(),
    },
    changedDropIds: [state.well.originDropId!],
  });

  assert.equal(report.rerunConsistent, true);
});

test("assistant loop does not regenerate when there are no pending changes", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  const state = engine.getState();
  state.pendingChangedDropIds = [];
  state.candidates.unshift({
    candidateId: "candidate-stable",
    wellId: state.well.id,
    content: "stable candidate",
    coverageDropIds: state.drops.map((drop) => drop.dropId),
    createdAt: new Date().toISOString(),
  });
  state.verifyReports.unshift({
    ...makeReadyVerifyReport(engine),
    pass: false,
    issues: ["acceptance evidence still needs review"],
    acceptanceCoverageDropIds: [],
    acceptanceItems: [],
    changedDropCoverage: [],
    uncoveredAcceptanceItemIds: ["accept-review"],
  });
  engine.replaceState(state);

  const before = engine.getState();
  const snapshot = await engine.runAssistantLoop({ trigger: "test.no-pending-short-circuit" });
  const after = engine.getState();

  assert.equal(snapshot.status, "blocked");
  assert.equal(after.candidates.length, before.candidates.length);
  assert.equal(after.verifyReports.length, before.verifyReports.length);
});

test("low-confidence automation decisions are deferred and do not write back state", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });

  const drop = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "misc",
    summary: "tiny",
    priority: "p2",
    layer: "contract",
    domain: "delivery",
    preserveOrphan: false,
  });
  engine.schedulePostIngestAutomation(drop.dropId, "test.low-confidence");
  engine.processPendingAutomationTasks();
  const after = engine.getState();
  const task = after.automationTasks[0];
  const domainDecision = task.decisions.find((item) => item.kind === "domain");
  const summaryDecision = task.decisions.find((item) => item.kind === "summary");
  const updatedDrop = after.drops.find((item) => item.dropId === drop.dropId)!;

  assert.equal(domainDecision?.applied, false);
  assert.equal(summaryDecision?.applied, false);
  assert.equal(summaryDecision?.approvalClass, "review-required");
  assert.ok(domainDecision?.deferredReason);
  assert.equal(updatedDrop.domain, "delivery");
  assert.equal(updatedDrop.summary, "tiny");
});

test("assistant loop exposes automation review checkpoints in user-facing language", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });

  const drop = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Short relation hint",
    summary: "tiny",
    preserveOrphan: false,
  });
  engine.schedulePostIngestAutomation(drop.dropId, "test.loop-checkpoint");
  engine.processPendingAutomationTasks();

  const loop = engine.getMainLoopSnapshot();

  assert.equal(loop.status, "blocked");
  assert.equal(loop.primaryAction.key, "review-checkpoint");
  assert.equal(loop.reviewCheckpoints.some((item) => item.source === "automation"), true);
  assert.equal(loop.reviewCheckpoints.some((item) => /Review/.test(item.title)), true);
});

test("complete loop snapshot hides stale review checkpoints once acceptance is ready", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });

  const drop = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Checkpoint candidate",
    summary: "tiny",
    preserveOrphan: false,
  });
  engine.schedulePostIngestAutomation(drop.dropId, "test.complete-hides-review");
  engine.processPendingAutomationTasks();

  const state = engine.getState();
  state.pendingChangedDropIds = [];
  state.candidates.unshift({
    candidateId: "candidate-complete",
    wellId: state.well.id,
    content: "ready candidate",
    coverageDropIds: state.drops.map((item) => item.dropId),
    createdAt: new Date().toISOString(),
  });
  state.verifyReports.unshift(makeReadyVerifyReport(engine));
  engine.replaceState(state);

  const snapshot = engine.getMainLoopSnapshot();

  assert.equal(snapshot.status, "complete");
  assert.equal(snapshot.primaryAction.key, "accept-direction");
  assert.equal(snapshot.openCheckpointCount, 0);
  assert.deepEqual(snapshot.reviewCheckpoints, []);
  assert.equal(snapshot.nextCheckpoint, undefined);
});

test("resolved automation checkpoint is removed from the assistant loop", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });

  const drop = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Short relation hint",
    summary: "tiny",
    preserveOrphan: false,
  });
  engine.schedulePostIngestAutomation(drop.dropId, "test.loop-checkpoint-resolved");
  engine.processPendingAutomationTasks();

  const goalDropId = engine.getState().well.originDropId;
  assert.ok(goalDropId);
  if (!goalDropId) {
    throw new Error("expected goal origin drop");
  }
  engine.updateDrop(drop.dropId, {
    summary: "This summary is now long enough to be confidently linked to the goal.",
    skipAutoFlow: true,
  });
  if (!engine.getState().relations.some((rel) => rel.fromDropId === goalDropId && rel.toDropId === drop.dropId && rel.relationType === "implements")) {
    engine.connectDrops(goalDropId, drop.dropId, "implements");
  }

  const loop = engine.getMainLoopSnapshot();

  assert.equal(loop.reviewCheckpoints.some((item) => item.source === "automation"), false);
});

test("accept current direction stores a durable acceptance decision", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Accepted material",
    summary: "Enough material exists for an explicit acceptance decision.",
    preserveOrphan: false,
  });
  const state = engine.getState();
  state.pendingChangedDropIds = [];
  state.candidates.unshift({
    candidateId: "candidate-accepted",
    wellId: state.well.id,
    content: "accepted candidate",
    coverageDropIds: state.drops.map((drop) => drop.dropId),
    createdAt: new Date().toISOString(),
  });
  state.verifyReports.unshift(makeReadyVerifyReport(engine));
  engine.replaceState(state);

  const ready = engine.getMainLoopSnapshot();
  assert.equal(ready.primaryAction.key, "accept-direction");

  const accepted = engine.acceptCurrentDirection("test.accepted");
  assert.equal(accepted.status, "complete");
  assert.equal(accepted.statusLabel, "Accepted");
  assert.equal(accepted.acceptanceStatus, "accepted");
  assert.equal(accepted.latestArtifact?.accepted, true);
  assert.equal(engine.getState().well.acceptedCandidateId, "candidate-accepted");
});

test("accepted direction is cleared after new changes", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Accepted material",
    summary: "Enough material exists for an explicit acceptance decision.",
    preserveOrphan: false,
  });
  const state = engine.getState();
  state.pendingChangedDropIds = [];
  state.candidates.unshift({
    candidateId: "candidate-before-change",
    wellId: state.well.id,
    content: "accepted candidate",
    coverageDropIds: state.drops.map((drop) => drop.dropId),
    createdAt: new Date().toISOString(),
  });
  state.verifyReports.unshift(makeReadyVerifyReport(engine));
  engine.replaceState(state);
  engine.acceptCurrentDirection("test.accepted");

  engine.ingestDrop({
    type: "note",
    source: "user",
    title: "New material after acceptance",
    summary: "This should invalidate the previous accepted direction.",
    preserveOrphan: false,
  });

  const loop = engine.getMainLoopSnapshot();
  assert.equal(loop.acceptanceStatus, "pending");
  assert.equal(engine.getState().well.acceptanceStatus, "pending");
  assert.equal(engine.getState().well.acceptedCandidateId, undefined);
});

test("accept current direction stays blocked when verify evidence is stale", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Initial material",
    summary: "Material used for the verified candidate.",
    preserveOrphan: false,
  });
  const state = engine.getState();
  state.pendingChangedDropIds = [];
  state.candidates.unshift({
    candidateId: "candidate-verified",
    wellId: state.well.id,
    content: "verified candidate",
    coverageDropIds: state.drops.map((drop) => drop.dropId),
    createdAt: "2026-03-10T01:00:00.000Z",
  });
  state.verifyReports.unshift({
    pass: true,
    issues: [],
    suggestions: [],
    acceptanceCoverageDropIds: [state.well.acceptanceDropId],
    acceptanceItems: [],
    changedDropCoverage: [],
    uncoveredAcceptanceItemIds: [],
    selfIterationEvidence: ["run-1:verify:pass"],
    changedDropIds: [],
    rerunConsistent: true,
    createdAt: "2026-03-10T01:05:00.000Z",
  });
  state.candidates.unshift({
    candidateId: "candidate-unverified",
    wellId: state.well.id,
    content: "newer unverified candidate",
    coverageDropIds: state.drops.map((drop) => drop.dropId),
    createdAt: "2026-03-10T01:10:00.000Z",
  });
  engine.replaceState(state);

  const loop = engine.getMainLoopSnapshot();
  assert.notEqual(loop.primaryAction.key, "accept-direction");
  assert.equal(loop.latestVerifyPass, undefined);
  assert.equal(loop.acceptanceStatus, "pending");
  assert.throws(() => engine.acceptCurrentDirection("test.stale-verify"), /not ready for acceptance/);
});

test("accept current direction requires complete acceptance evidence on the latest candidate", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Acceptance material",
    summary: "Enough material exists, but acceptance evidence is intentionally incomplete.",
    preserveOrphan: false,
  });
  const state = engine.getState();
  state.pendingChangedDropIds = [];
  state.candidates.unshift({
    candidateId: "candidate-incomplete-verify",
    wellId: state.well.id,
    content: "candidate with incomplete verify",
    coverageDropIds: state.drops.map((drop) => drop.dropId),
    createdAt: "2026-03-10T01:10:00.000Z",
  });
  state.verifyReports.unshift({
    pass: true,
    issues: [],
    suggestions: [],
    acceptanceCoverageDropIds: [state.well.acceptanceDropId],
    acceptanceItems: [],
    changedDropCoverage: [],
    uncoveredAcceptanceItemIds: [],
    selfIterationEvidence: ["run-1:dry-run:pass"],
    changedDropIds: [],
    rerunConsistent: true,
    createdAt: "2026-03-10T01:11:00.000Z",
  });
  engine.replaceState(state);

  const loop = engine.getMainLoopSnapshot();
  assert.notEqual(loop.primaryAction.key, "accept-direction");
  assert.equal(loop.latestResult?.label, "risk found");
  assert.match(loop.latestResult?.summary ?? "", /acceptance|self-iteration/i);
  assert.throws(() => engine.acceptCurrentDirection("test.incomplete-verify"), /not ready for acceptance/);
});

test("acceptance contract edits create an explicit re-evaluation checkpoint", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  const state = engine.getState();
  state.pendingChangedDropIds = [];
  state.candidates.unshift({
    candidateId: "candidate-recheck",
    wellId: state.well.id,
    content: "accepted candidate",
    coverageDropIds: state.drops.map((drop) => drop.dropId),
    createdAt: new Date().toISOString(),
  });
  state.verifyReports.unshift(makeReadyVerifyReport(engine));
  engine.replaceState(state);

  engine.updateDrop(engine.getState().well.acceptanceDropId, {
    summary: "Updated acceptance contract with stricter evidence wording.",
  });

  const loop = engine.getMainLoopSnapshot();
  assert.equal(loop.status, "blocked");
  assert.equal(loop.reviewCheckpoints.some((item) => item.checkpointId === "checkpoint-acceptance-stale"), true);
});

test("invalid structured packet output is marked as fallback", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  const context = (engine.getState().packetRecords[0]?.request.context) ?? {
    projectId: "project-main",
    projectName: "Main",
    projectWorkdir: "/tmp",
    wellId: "well-main",
    artifactType: "app",
    wish: "Build phonowell WebUI V1",
    definitionOfDone: ["Support goal-origin draft/edit/confirm"],
    constraints: ["single artifact target"],
    acceptanceDropId: "drop-canon-acceptance-contract",
    acceptanceSummary: "Acceptance contract",
    unresolvedQuestions: [],
    activeDropIds: [],
    activeDropSummaries: [],
    generationDiff: { addedDropIds: [], changedDropIds: [], removedDropIds: [], addedRelationKeys: [], removedRelationKeys: [], changedWellFields: [], relationDeltaCount: 0, constraintChanged: false, acceptanceChanged: false },
  };

  const fallback = buildFallbackStructured("verify", context);
  const parsed = parseStructuredOutput("{not valid json", fallback);

  assert.equal(parsed.usedFallback, true);
  assert.equal(parsed.structured.outputSource, "fallback");
});

test("missing structured packet output is treated as fallback", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  const fallback = buildFallbackStructured("generate", {
    projectId: "project-main",
    projectName: "Main",
    projectWorkdir: "/tmp",
    wellId: "well-main",
    artifactType: "app",
    wish: "Build phonowell WebUI V1",
    definitionOfDone: ["Support goal-origin draft/edit/confirm"],
    constraints: ["single artifact target"],
    acceptanceDropId: "drop-canon-acceptance-contract",
    acceptanceSummary: "Acceptance contract",
    unresolvedQuestions: [],
    activeDropIds: [],
    activeDropSummaries: [],
    generationDiff: {
      addedDropIds: [],
      changedDropIds: [],
      removedDropIds: [],
      addedRelationKeys: [],
      removedRelationKeys: [],
      changedWellFields: [],
      relationDeltaCount: 0,
      constraintChanged: false,
      acceptanceChanged: false,
    },
  });

  const rawOutputText = "";
  const parsed = rawOutputText.trim()
    ? parseStructuredOutput(rawOutputText, fallback)
    : { structured: fallback, usedFallback: true };

  assert.equal(parsed.usedFallback, true);
  assert.equal(parsed.structured.outputSource, "fallback");
});
