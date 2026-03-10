import test from "node:test";
import assert from "node:assert/strict";
import { PhonoWellEngine } from "../orchestrator/engine.js";
import {
  INBOX_DOMAIN_ID,
  SYSTEM_DOMAIN_ID,
  organizeInboxDomains,
  updateDomainNode,
} from "../orchestrator/domain-map-service.js";
import {
  buildRequirementSnapshot,
  diffRequirementSnapshots,
  recordGenerationRun,
} from "../orchestrator/generation-requirements.js";
import { summarizeWorkspaceView } from "../orchestrator/workspace-view.js";
import {
  listWorkspacePolicies,
  stabilizeWorkspacePolicies,
  WORKSPACE_POLICY_CLUSTER_LABEL,
} from "../orchestrator/workspace-policy-service.js";

process.env.PHONOWELL_DISABLE_CODEX_RUNTIME = "1";

test("domain map bootstraps with system and inbox nodes and new user assets land in inbox", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();

  const initial = engine.getState();
  assert.ok(initial.domainNodes.some((node) => node.domainId === SYSTEM_DOMAIN_ID));
  assert.ok(initial.domainNodes.some((node) => node.domainId === INBOX_DOMAIN_ID));

  const created = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Loose material",
    summary: "Unsorted user material should first arrive in the inbox.",
    preserveOrphan: true,
  });

  const after = engine.getState();
  const inserted = after.drops.find((drop) => drop.dropId === created.dropId);
  assert.equal(inserted?.domainId, INBOX_DOMAIN_ID);
  assert.ok(after.activityTimeline.some((item) =>
    item.kind === "ingest" && item.relatedDropIds.includes(created.dropId),
  ));
});

test("organizeInboxDomains creates workspace domains and assigns inbox drops", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  const created = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Combat damage tables",
    summary: "Damage curves, weapons, enemies, and hit reactions.",
    preserveOrphan: true,
  });

  const state = engine.getState();
  const result = organizeInboxDomains(state, "test.domain-map-organize");

  assert.equal(result.assignedDropIds.includes(created.dropId), true);
  assert.equal(result.createdDomainIds.length >= 1, true);

  const organizedDrop = state.drops.find((drop) => drop.dropId === created.dropId);
  assert.ok(organizedDrop);
  assert.notEqual(organizedDrop?.domainId, INBOX_DOMAIN_ID);
  assert.ok(state.domainNodes.some((node) => node.domainId === organizedDrop?.domainId && node.kind === "workspace"));
  assert.ok(state.activityTimeline.some((item) =>
    item.kind === "domain-created" || item.kind === "organize",
  ));
});

test("generation requirement history records diffs against the previous snapshot", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.ingestDrop({
    type: "note",
    source: "user",
    title: "UI moodboard",
    summary: "Menu flows, HUD hierarchy, and onboarding notes.",
    preserveOrphan: true,
  });

  const state = engine.getState();
  organizeInboxDomains(state, "test.requirement-history");

  const firstSnapshot = buildRequirementSnapshot(state);
  const firstDiff = diffRequirementSnapshots(undefined, firstSnapshot);
  recordGenerationRun(state, {
    candidateId: "candidate-first",
    snapshot: firstSnapshot,
    diff: firstDiff,
  });

  state.well.constraints = [...state.well.constraints, "prefer mature third-party libraries"];
  state.well.wish = "Ship a clean domain map workspace";

  const nextSnapshot = buildRequirementSnapshot(state);
  const nextDiff = diffRequirementSnapshots(state.generationHistory[0]?.snapshot, nextSnapshot);
  recordGenerationRun(state, {
    candidateId: "candidate-second",
    snapshot: nextSnapshot,
    diff: nextDiff,
  });

  assert.ok(nextDiff.entries.some((entry) =>
    entry.key === "wish" && entry.status === "changed",
  ));
  assert.ok(nextDiff.entries.some((entry) =>
    entry.key === "constraint:prefer mature third-party libraries" && entry.status === "added",
  ));
  assert.equal(state.generationHistory.length, 2);
});

test("frozen workspace domains stop absorbing new inbox assets with the same heuristic", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Combat kit",
    summary: "Weapons and enemies for the first combat domain.",
    preserveOrphan: true,
  });

  const state = engine.getState();
  organizeInboxDomains(state, "test.freeze-domain-initial");
  const firstDomain = state.domainNodes.find((node) => node.kind === "workspace");
  assert.ok(firstDomain);
  if (!firstDomain) {
    throw new Error("expected workspace domain");
  }

  updateDomainNode(state, firstDomain.domainId, {
    frozen: true,
    actor: "user",
  });

  state.drops.push({
    ...state.drops.find((drop) => drop.domainId === firstDomain.domainId)!,
    dropId: "drop-new-combat",
    title: "Combat encounters v2",
    summary: "More combat content that should not be auto-merged into the frozen domain.",
    domainId: INBOX_DOMAIN_ID,
    clusterId: undefined,
    clusterLabel: undefined,
    frozenPlacement: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const result = organizeInboxDomains(state, "test.freeze-domain-next");
  const reassigned = state.drops.find((drop) => drop.dropId === "drop-new-combat");

  assert.equal(result.assignedDropIds.includes("drop-new-combat"), true);
  assert.ok(reassigned);
  assert.notEqual(reassigned?.domainId, firstDomain.domainId);
  assert.ok(state.domainNodes.some((node) =>
    node.kind === "workspace" && node.domainId !== firstDomain.domainId && node.assetDropIds.includes("drop-new-combat"),
  ));
});

test("workspace view stays in quick-task mode up to ten user assets", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();

  for (let index = 0; index < 10; index += 1) {
    engine.ingestDrop({
      type: "note",
      source: "user",
      title: `Quick asset ${index + 1}`,
      summary: `Single-theme quick task asset ${index + 1}.`,
      preserveOrphan: true,
    });
  }

  const snapshot = summarizeWorkspaceView(engine.getState());
  assert.equal(snapshot.suggestedMode, "quick-task");
  assert.equal(snapshot.metrics.userAssetCount, 10);
});

test("workspace view promotes to domain-map when user assets exceed ten", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();

  for (let index = 0; index < 11; index += 1) {
    engine.ingestDrop({
      type: "note",
      source: "user",
      title: `Promoted asset ${index + 1}`,
      summary: `Quick task asset ${index + 1} that pushes the task over threshold.`,
      preserveOrphan: true,
    });
  }

  const snapshot = summarizeWorkspaceView(engine.getState());
  assert.equal(snapshot.suggestedMode, "domain-map");
  assert.ok(snapshot.reasons.some((item) => item.includes("超过 Quick Task 阈值 10")));
});

test("workspace policy assets are lifted into the system domain instead of being treated as ordinary notes", () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  const created = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "全局规则",
    summary: "所有资产都应该是中文",
    preserveOrphan: true,
  });

  const state = engine.getState();
  const beforePolicyDrop = state.drops.find((drop) => drop.dropId === created.dropId);
  assert.equal(beforePolicyDrop?.domainId, INBOX_DOMAIN_ID);

  const result = stabilizeWorkspacePolicies(state, "test.workspace-policy");
  const activated = state.drops.find((drop) => drop.dropId === created.dropId);

  assert.equal(result.activatedPolicies.length, 1);
  assert.ok(listWorkspacePolicies(state).some((policy) => policy.sourceDropId === created.dropId));
  assert.equal(activated?.domainId, SYSTEM_DOMAIN_ID);
  assert.equal(activated?.layer, "policy");
  assert.equal(activated?.scope, "well-global");
  assert.equal(activated?.clusterLabel, WORKSPACE_POLICY_CLUSTER_LABEL);
  assert.ok(state.activityTimeline.some((item) =>
    item.kind === "policy-detected" && item.relatedDropIds.includes(created.dropId),
  ));
});

test("deep organize runs a workspace policy pass when active policies exist", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  engine.ingestDrop({
    type: "note",
    source: "user",
    title: "视觉草图",
    summary: "Main menu concept art and scene composition notes.",
    preserveOrphan: true,
  });
  const policy = engine.ingestDrop({
    type: "note",
    source: "user",
    title: "统一要求",
    summary: "所有资产都应该是中文",
    preserveOrphan: true,
  });

  const result = await engine.runDeepOrganize("test.workspace-policy-pass");
  const state = engine.getState();
  const policyDrop = state.drops.find((drop) => drop.dropId === policy.dropId);
  const latestPacket = engine.getPacketRecords()[0];

  assert.ok(result.policyPacket);
  assert.ok(latestPacket);
  assert.ok(latestPacket.request.context.workspacePolicies?.some((item) => item.sourceDropId === policy.dropId));
  assert.equal(policyDrop?.domainId, SYSTEM_DOMAIN_ID);
  assert.equal(policyDrop?.layer, "policy");
  assert.ok(state.activityTimeline.some((item) => item.kind === "policy-applied"));
});
