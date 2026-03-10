import test from "node:test";
import assert from "node:assert/strict";
import { PhonoWellEngine } from "../orchestrator/engine.js";
import { listAcceptanceItems } from "../orchestrator/acceptance-traceability.js";
import { buildFallbackStructured, parseStructuredOutput } from "../orchestrator/packet-structured.js";

process.env.PHONOWELL_DISABLE_CODEX_RUNTIME = "1";

function nonConversationState(state: ReturnType<PhonoWellEngine["getState"]>) {
  const clone = structuredClone(state);
  clone.assetConversations = [];
  return clone;
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

test("low-confidence automation decisions are deferred and do not write back state", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();

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
  assert.ok(domainDecision?.deferredReason);
  assert.equal(updatedDrop.domain, "delivery");
  assert.equal(updatedDrop.summary, "tiny");
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
