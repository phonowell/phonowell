import { randomUUID } from "node:crypto";
import type {
  AutomationDecision,
  AutomationTaskRecord,
  AssetDomain,
  AssetOwner,
  AssetScope,
  AssetSource,
  AssetType,
  CandidateArtifact,
  CatalogAsset,
  ChangeProposal,
  ChangedWellField,
  ConversationAnalysis,
  Drop,
  DryRunReport,
  DryRunStatus,
  GenerationDiff,
  MicroLifecycleSummary,
  MainLoopSnapshot,
  PacketContext,
  PacketRecord,
  PacketStage,
  Priority,
  PriorityLifecycleAuditRecord,
  ProjectState,
  Relation,
  RelationType,
  ConversationMessage,
  RunLog,
  VerifyRouteExecution,
  VerifyCycleRecord,
  VerifyReport,
  Well,
  WellState,
} from "./types.js";
import { resolveFromWorkspaceRoot } from "../runtime-paths.js";
import { loadAssetCatalog } from "./asset-catalog.js";
import { appendAcceptanceTraceLinks, inferTraceLinksFromText } from "./acceptance-traceability.js";
import { runPacket } from "./packet-runtime.js";
import { analyzeConversation } from "./conversation-service.js";
import { deriveUnresolvedQuestions } from "./conflict-service.js";
import { buildProposalFromPacket } from "./proposal-service.js";
import { evaluateDryRun } from "./dry-run-service.js";
import { buildCandidateArtifact } from "./generation-service.js";
import {
  applyActionResult,
  applyMicroLifecycleAction,
  applyProposalAction,
  annotateConflictsAction,
  connectDropsAction,
  ensureGoalOriginDraftAction,
  ensureIntentHypothesisAction,
  ingestDropAction,
  removeRelationAction,
  runHeuristicAnalyzeAction,
  runHeuristicGapCheckAction,
  runHeuristicOrganizeAction,
  setAcceptanceTraceLinksAction,
  setWishAction,
  updateDropAction,
  updateGoalOriginAction,
  updateUnresolvedQuestionsAction,
} from "./action-service.js";
import { buildRouteFailure } from "./verify-execution.js";
import {
  buildSelfIterationRecord,
  buildVerifyCycle,
  buildVerifyReport,
  evaluatePriorityLifecycle,
  pickVerifyRoute,
} from "./verification-service.js";

function nowIso(): string {
  return new Date().toISOString();
}

function relationKey(rel: Pick<Relation, "fromDropId" | "toDropId" | "relationType">): string {
  return `${rel.fromDropId}|${rel.toDropId}|${rel.relationType}`;
}

function makeCanonicalDrop(wellId: string, asset: CatalogAsset, createdAt: string): Drop {
  return {
    dropId: asset.dropId,
    wellId,
    type: asset.type,
    domain: asset.domain,
    scope: asset.scope,
    source: "docs",
    owner: asset.owner,
    layer: asset.layer,
    title: asset.title,
    summary: asset.summary,
    purpose: asset.purpose,
    content: asset.summary,
    sourceFile: asset.sourceFile,
    priority: asset.priority,
    confidence: 0.95,
    licenseState: "known",
    createdAt,
    updatedAt: createdAt,
  };
}

export class PhonoWellEngine {
  private readonly catalog: CatalogAsset[];

  private readonly state: WellState;

  constructor() {
    const createdAt = nowIso();
    this.catalog = loadAssetCatalog();

    const well: Well = {
      id: "well-main",
      artifactType: "app",
      wish: "Build phonowell WebUI V1",
      definitionOfDone: [
        "Support goal-origin draft/edit/confirm",
        "Support drop and connect on canvas",
        "Run dry-run before generate",
        "Record verify report with acceptance coverage",
      ],
      constraints: [
        "single artifact target",
        "low cognitive load",
        "reuse first",
      ],
      acceptanceDropId: "drop-canon-acceptance-contract",
      status: "goal-origin-init",
      dryRunStatus: "warn",
      createdAt,
      updatedAt: createdAt,
    };

    const project: ProjectState = {
      projectId: "project-main",
      name: "Main",
      slug: "main",
      workdir: resolveFromWorkspaceRoot(".phonowell", "projects", "main"),
      createdAt,
      updatedAt: createdAt,
    };

    const canonicalDrops = this.catalog
      .filter((asset) => asset.active)
      .map<Drop>((asset) => makeCanonicalDrop(well.id, asset, createdAt));

    const relations = this.buildBaselineRelations(well.id, createdAt);

    this.state = {
      schemaVersion: "1.1.0",
      project,
      well,
      drops: canonicalDrops,
      relations,
      candidates: [],
      proposals: [],
      verifyReports: [],
      verifyCycles: [],
      selfIterationRecords: [],
      packetRecords: [],
      pendingChangedDropIds: [],
      runLogs: [],
      unresolvedQuestions: [],
      assetConversations: [],
      automationTasks: [],
    };
  }

  bootstrapInitialState(): WellState {
    const hasGoalOrigin = this.state.drops.some((drop) => drop.type === "goal-origin");
    if (!hasGoalOrigin) {
      this.ensureGoalOriginDraft();
      this.ensureIntentHypothesis();
      this.annotateConflicts();
      this.applyMicroLifecycle();
      this.pushRunLog({
        stage: "intake",
        status: "pass",
        summary: "bootstrap.initialized",
        payload: { originDropId: this.state.well.originDropId ?? null },
      });
    }
    return this.getState();
  }

  private makeRelation(
    wellId: string,
    fromDropId: string,
    toDropId: string,
    relationType: RelationType,
    createdAt = nowIso(),
  ): Relation {
    return {
      relationId: `rel-${randomUUID().slice(0, 8)}`,
      wellId,
      fromDropId,
      toDropId,
      relationType,
      createdAt,
    };
  }

  getState(): WellState {
    return structuredClone(this.state);
  }

  getCatalog(): CatalogAsset[] {
    return structuredClone(this.catalog);
  }

  replaceState(nextState: WellState): WellState {
    const synced = this.syncActiveCatalog(nextState);
    const dropIds = new Set(
      synced.drops
        .filter((drop) => drop.domain !== "legacy")
        .map((drop) => drop.dropId),
    );

    this.state.schemaVersion = synced.schemaVersion;
    this.state.project = synced.project ?? this.state.project;
    this.state.well = synced.well;
    this.state.drops = synced.drops.filter((drop) => drop.domain !== "legacy");
    this.state.relations = synced.relations.filter(
      (rel) => dropIds.has(rel.fromDropId) && dropIds.has(rel.toDropId),
    );
    this.state.candidates = synced.candidates;
    this.state.proposals = synced.proposals ?? [];
    this.state.verifyReports = synced.verifyReports;
    this.state.verifyCycles = synced.verifyCycles;
    this.state.selfIterationRecords = synced.selfIterationRecords ?? [];
    this.state.packetRecords = synced.packetRecords ?? [];
    this.state.pendingChangedDropIds = synced.pendingChangedDropIds ?? [];
    this.state.runLogs = synced.runLogs;
    this.state.unresolvedQuestions = synced.unresolvedQuestions;
    this.state.assetConversations = synced.assetConversations ?? [];
    this.state.automationTasks = synced.automationTasks ?? [];
    return this.getState();
  }

  private syncActiveCatalog(input: WellState): WellState {
    const state = structuredClone(input);
    const createdAt = nowIso();
    const activeAssets = this.catalog.filter((asset) => asset.active);
    const assetById = new Map(activeAssets.map((asset) => [asset.dropId, asset]));
    const existingDropById = new Map(state.drops.map((drop) => [drop.dropId, drop]));

    const canonicalDrops = activeAssets.map((asset) => {
      const existing = existingDropById.get(asset.dropId);
      if (!existing) {
        return makeCanonicalDrop(state.well.id, asset, createdAt);
      }
      return {
        ...existing,
        wellId: state.well.id,
        type: asset.type,
        domain: asset.domain,
        scope: asset.scope,
        source: "docs",
        owner: asset.owner,
        layer: asset.layer,
        title: asset.title,
        summary: asset.summary,
        purpose: asset.purpose,
        content: asset.summary,
        sourceFile: asset.sourceFile,
        priority: asset.priority,
        confidence: Math.max(existing.confidence ?? 0.95, 0.95),
        licenseState: "known",
      } satisfies Drop;
    });

    const userDrops = state.drops.filter((drop) => !assetById.has(drop.dropId) && drop.domain !== "legacy");
    state.drops = [...userDrops, ...canonicalDrops];

    const requiredRelations = this.buildBaselineRelations(state.well.id, createdAt);
    const relationByKey = new Map(state.relations.map((rel) => [relationKey(rel), rel]));
    for (const required of requiredRelations) {
      const key = relationKey(required);
      if (!relationByKey.has(key)) {
        relationByKey.set(key, required);
      }
    }

    const validDropIds = new Set(state.drops.map((drop) => drop.dropId));
    state.relations = [...relationByKey.values()].filter(
      (rel) => validDropIds.has(rel.fromDropId) && validDropIds.has(rel.toDropId),
    );
    state.schemaVersion = "1.1.0";
    return state;
  }

  private enqueueAutomationTask(task: AutomationTaskRecord): void {
    this.state.automationTasks.unshift(task);
    this.state.automationTasks = this.state.automationTasks.slice(0, 20);
  }

  bindDropToAcceptanceItems(dropId: string, itemIds: string[], rationale = "manual bind"): Drop {
    const drop = this.state.drops.find((item) => item.dropId === dropId);
    if (!drop) {
      throw new Error(`drop not found: ${dropId}`);
    }
    appendAcceptanceTraceLinks(drop, itemIds.map((itemId) => ({
      itemId,
      source: "manual-link",
      rationale,
      evidence: [
        {
          kind: "drop",
          ref: dropId,
          detail: `manual trace link for ${itemId}`,
          source: "manual-link",
        },
      ],
    })));
    return applyActionResult(this.state, setAcceptanceTraceLinksAction(this.state, dropId, drop.acceptanceTraceLinks ?? []));
  }

  private inferSummaryCandidate(drop: Drop): AutomationDecision {
    const proposedSummary = drop.summary.length >= 40
      ? drop.summary
      : `${drop.title}: ${drop.summary}`.slice(0, 160);
    const confidence = drop.summary.length >= 40 ? 0.92 : 0.74;
    const applied = confidence >= 0.85 && proposedSummary !== drop.summary;
    if (applied) {
      drop.summary = proposedSummary;
      drop.content = proposedSummary;
      drop.updatedAt = nowIso();
      if (!this.state.pendingChangedDropIds.includes(drop.dropId)) {
        this.state.pendingChangedDropIds.push(drop.dropId);
      }
    }
    return {
      decisionId: `decision-${randomUUID().slice(0, 8)}`,
      kind: "summary",
      source: "heuristic",
      targetDropId: drop.dropId,
      proposedValue: proposedSummary,
      confidence,
      applied,
      evidence: [`title=${drop.title}`, `summary-length=${drop.summary.length}`],
      ...(applied ? { appliedReason: "summary length and confidence crossed auto-apply threshold" } : { deferredReason: "confidence below auto-apply threshold or no-op" }),
      createdAt: nowIso(),
    };
  }

  private inferMetadataCandidates(drop: Drop): AutomationDecision[] {
    const normalized = `${drop.title} ${drop.summary}`.toLowerCase();
    const layer = /contract|protocol|acceptance|goal|verify|execution/.test(normalized) ? "contract" : "reference";
    const domain = /reference|react|codex|design/.test(normalized) ? "reference" : /protocol|verify|runtime/.test(normalized) ? "protocol" : "delivery";
    const priority = /critical|verify|fail|block|acceptance|goal/.test(normalized) ? "p0" : /organize|runtime|packet|relation/.test(normalized) ? "p1" : "p2";
    const decisions: AutomationDecision[] = [];
    const inferred = [
      { kind: "layer" as const, proposedValue: layer, confidence: layer === drop.layer ? 0.99 : 0.78 },
      { kind: "domain" as const, proposedValue: domain, confidence: domain === drop.domain ? 0.99 : 0.77 },
      { kind: "priority" as const, proposedValue: priority, confidence: priority === drop.priority ? 0.99 : 0.72 },
    ];
    for (const item of inferred) {
      const currentValue =
        item.kind === "layer" ? drop.layer
          : item.kind === "domain" ? drop.domain
            : drop.priority;
      const applied = item.confidence >= 0.85 && currentValue !== item.proposedValue;
      if (applied) {
        if (item.kind === "layer") drop.layer = item.proposedValue as Drop["layer"];
        if (item.kind === "domain") drop.domain = item.proposedValue as Drop["domain"];
        if (item.kind === "priority") drop.priority = item.proposedValue as Priority;
        drop.updatedAt = nowIso();
        if (!this.state.pendingChangedDropIds.includes(drop.dropId)) {
          this.state.pendingChangedDropIds.push(drop.dropId);
        }
      }
      decisions.push({
        decisionId: `decision-${randomUUID().slice(0, 8)}`,
        kind: item.kind,
        source: "heuristic",
        targetDropId: drop.dropId,
        proposedValue: item.proposedValue,
        confidence: item.confidence,
        applied,
        evidence: [`drop=${drop.dropId}`, `normalized=${normalized.slice(0, 120)}`],
        ...(applied ? { appliedReason: "high-confidence heuristic classification" } : { deferredReason: "heuristic confidence below auto-apply threshold" }),
        createdAt: nowIso(),
      });
    }
    return decisions;
  }

  private inferRelationCandidates(drop: Drop): AutomationDecision[] {
    const decisions: AutomationDecision[] = [];
    const goalId = this.state.well.originDropId;
    if (!goalId) {
      return decisions;
    }
    const alreadyConnected = this.state.relations.some((rel) => rel.fromDropId === drop.dropId || rel.toDropId === drop.dropId);
    const confidence = alreadyConnected ? 0.98 : 0.9;
    if (!alreadyConnected) {
      this.connectDrops(goalId, drop.dropId, "implements");
    }
    decisions.push({
      decisionId: `decision-${randomUUID().slice(0, 8)}`,
      kind: "relation",
      source: "heuristic",
      targetDropId: drop.dropId,
      proposedValue: `${goalId}->${drop.dropId}:implements`,
      confidence,
      applied: !alreadyConnected,
      evidence: [`goal=${goalId}`, `connected=${String(alreadyConnected)}`],
      ...(!alreadyConnected ? { appliedReason: "missing relation to goal origin" } : { deferredReason: "relation already present" }),
      createdAt: nowIso(),
    });
    return decisions;
  }

  private inferConflictHints(drop: Drop): AutomationDecision[] {
    const evidence = this.state.unresolvedQuestions.filter((question) => question.toLowerCase().includes(drop.title.toLowerCase().slice(0, 12)));
    const confidence = evidence.length > 0 ? 0.7 : 0.28;
    return [{
      decisionId: `decision-${randomUUID().slice(0, 8)}`,
      kind: "conflict",
      source: "heuristic",
      targetDropId: drop.dropId,
      proposedValue: evidence[0] ?? "no conflict hint",
      confidence,
      applied: false,
      evidence: evidence.length > 0 ? evidence : ["no matching unresolved question"],
      deferredReason: evidence.length > 0 ? "conflict hints are advisory only" : "no conflict evidence",
      createdAt: nowIso(),
    }];
  }

  processPendingAutomationTasks(): AutomationTaskRecord[] {
    const updated: AutomationTaskRecord[] = [];
    for (const task of this.state.automationTasks) {
      if (task.status !== "pending") {
        continue;
      }
      task.status = "running";
      task.startedAt = nowIso();
      const drop = this.state.drops.find((item) => item.dropId === task.sourceDropId);
      if (!drop) {
        task.status = "failed";
        task.error = `drop not found: ${task.sourceDropId}`;
        task.completedAt = nowIso();
        updated.push(structuredClone(task));
        continue;
      }

      const decisions: AutomationDecision[] = [];
      decisions.push(this.inferSummaryCandidate(drop));
      decisions.push(...this.inferMetadataCandidates(drop));
      decisions.push(...this.inferRelationCandidates(drop));
      decisions.push(...this.inferConflictHints(drop));
      const inferredLinks = inferTraceLinksFromText(drop, this.state);
      if (inferredLinks.length > 0) {
        appendAcceptanceTraceLinks(drop, inferredLinks);
      }
      const preflightBefore = this.state.well.dryRunReport?.gateResult ?? "none";
      const preflight = this.runDryRun();
      decisions.push({
        decisionId: `decision-${randomUUID().slice(0, 8)}`,
        kind: "preflight",
        source: "system-rule",
        targetDropId: drop.dropId,
        proposedValue: preflight.gateResult,
        confidence: 1,
        applied: true,
        evidence: [`before=${preflightBefore}`, `after=${preflight.gateResult}`],
        appliedReason: "preflight refresh is mandatory after automation pass",
        createdAt: nowIso(),
      });

      task.decisions = decisions;
      task.steps = [
        {
          step: "summarize",
          status: "completed",
          evidence: decisions.filter((item) => item.kind === "summary").map((item) => `${item.proposedValue}:${item.confidence}`),
          decisionIds: decisions.filter((item) => item.kind === "summary").map((item) => item.decisionId),
        },
        {
          step: "candidate-metadata",
          status: "completed",
          evidence: decisions.filter((item) => ["layer", "domain", "priority"].includes(item.kind)).map((item) => `${item.kind}:${item.proposedValue}:${item.confidence}`),
          decisionIds: decisions.filter((item) => ["layer", "domain", "priority"].includes(item.kind)).map((item) => item.decisionId),
        },
        {
          step: "relations",
          status: "completed",
          evidence: decisions.filter((item) => item.kind === "relation").map((item) => item.proposedValue),
          decisionIds: decisions.filter((item) => item.kind === "relation").map((item) => item.decisionId),
        },
        {
          step: "conflicts",
          status: "completed",
          evidence: decisions.filter((item) => item.kind === "conflict").map((item) => item.proposedValue),
          decisionIds: decisions.filter((item) => item.kind === "conflict").map((item) => item.decisionId),
        },
        {
          step: "preflight",
          status: "completed",
          evidence: [`dry-run=${preflight.gateResult}`],
          decisionIds: decisions.filter((item) => item.kind === "preflight").map((item) => item.decisionId),
        },
      ];
      task.status = "completed";
      task.completedAt = nowIso();
      this.pushRunLog({
        stage: "ingest",
        status: "pass",
        summary: "automation.post-ingest.completed",
        payload: {
          taskId: task.taskId,
          sourceDropId: task.sourceDropId,
          appliedDecisionCount: decisions.filter((item) => item.applied).length,
          deferredDecisionCount: decisions.filter((item) => !item.applied).length,
        },
      });
      updated.push(structuredClone(task));
    }
    return updated;
  }

  schedulePostIngestAutomation(sourceDropId: string, trigger: string): AutomationTaskRecord {
    const queuedAt = nowIso();
    const task: AutomationTaskRecord = {
      taskId: `auto-${randomUUID().slice(0, 8)}`,
      kind: "post-ingest-organize",
      trigger,
      sourceDropId,
      status: "pending",
      queuedAt,
      steps: [
        { step: "summarize", status: "pending", evidence: [], decisionIds: [] },
        { step: "candidate-metadata", status: "pending", evidence: [], decisionIds: [] },
        { step: "relations", status: "pending", evidence: [], decisionIds: [] },
        { step: "conflicts", status: "pending", evidence: [], decisionIds: [] },
        { step: "preflight", status: "pending", evidence: [], decisionIds: [] },
      ],
      decisions: [],
    };
    this.enqueueAutomationTask(task);
    this.pushRunLog({
      stage: "ingest",
      status: "pass",
      summary: "automation.post-ingest.queued",
      payload: { taskId: task.taskId, sourceDropId, trigger },
    });
    return structuredClone(task);
  }

  private async executeVerifyRoute(route: VerifyCycleRecord["verifyRoute"]): Promise<VerifyRouteExecution> {
    const actions: string[] = [];
    const evidence: string[] = [];
    try {
      if (route === "gap-check") {
        applyActionResult(this.state, runHeuristicGapCheckAction(this.state));
        this.applyMicroLifecycle();
        actions.push("gap-fill");
      } else if (route === "analyze") {
        applyActionResult(this.state, runHeuristicAnalyzeAction(this.state));
        applyActionResult(this.state, runHeuristicOrganizeAction(this.state));
        this.applyMicroLifecycle();
        actions.push("analyze", "organize");
      } else {
        const report = this.state.well.dryRunReport ?? this.runDryRun();
        if (report.gateResult === "fail") {
          throw new Error("regenerate blocked: dry-run gate is fail");
        }
        const candidate = await this.generateArtifact();
        actions.push("candidate.regenerated");
        evidence.push(`candidate-id=${candidate.candidateId}`);
        evidence.push(`packet-id=${candidate.packetId ?? "none"}`);
        evidence.push(`coverage-drop-count=${candidate.coverageDropIds.length}`);
      }
      evidence.push(`pending-changed=${this.state.pendingChangedDropIds.length}`);
      return {
        route,
        executed: true,
        status: "pass",
        actions,
        evidence,
        createdAt: nowIso(),
      };
    } catch (error) {
      return buildRouteFailure(route, error, actions, evidence);
    }
  }

  private applyPriorityLifecycleRecommendations(
    recommendations: Array<{ dropId: string; from: Priority; to: Priority; reason: string }>,
  ): PriorityLifecycleAuditRecord[] {
    const audits: PriorityLifecycleAuditRecord[] = [];
    for (const recommendation of recommendations) {
      const drop = this.state.drops.find((item) => item.dropId === recommendation.dropId);
      if (!drop) {
        continue;
      }
      const overrideRequired = recommendation.to === "p0" && this.state.well.dryRunReport?.gateResult === "fail";
      const decision: PriorityLifecycleAuditRecord["decision"] = overrideRequired ? "deferred" : "applied";
      if (decision === "applied") {
        drop.priority = recommendation.to;
        drop.updatedAt = nowIso();
        if (!this.state.pendingChangedDropIds.includes(drop.dropId)) {
          this.state.pendingChangedDropIds.push(drop.dropId);
        }
      }
      audits.push({
        dropId: drop.dropId,
        from: recommendation.from,
        to: recommendation.to,
        reason: recommendation.reason,
        decision,
        overrideRequired,
        evidence: [
          `dry-run=${this.state.well.dryRunReport?.gateResult ?? "none"}`,
          `lifecycle=${drop.lifecycleState ?? "none"}`,
        ],
        createdAt: nowIso(),
      });
    }
    return audits;
  }

  private buildBaselineRelations(wellId: string, createdAt = nowIso()): Relation[] {
    return [
      this.makeRelation(wellId, "drop-canon-core-foundation", "drop-canon-execution-protocol", "constrains", createdAt),
      this.makeRelation(wellId, "drop-canon-core-foundation", "drop-canon-acceptance-contract", "constrains", createdAt),
      this.makeRelation(wellId, "drop-canon-core-foundation", "drop-canon-v1-delivery", "constrains", createdAt),
      this.makeRelation(wellId, "drop-canon-acceptance-contract", "drop-canon-execution-protocol", "constrains", createdAt),
      this.makeRelation(wellId, "drop-canon-acceptance-contract", "drop-canon-v1-delivery", "constrains", createdAt),
      this.makeRelation(wellId, "drop-canon-execution-protocol", "drop-canon-v1-delivery", "supports", createdAt),
      this.makeRelation(wellId, "drop-canon-execution-protocol", "drop-canon-v1-delivery", "constrains", createdAt),
      this.makeRelation(wellId, "drop-canon-data-format-contract", "drop-canon-state-versioning-contract", "constrains", createdAt),
      this.makeRelation(wellId, "drop-canon-data-format-contract", "drop-canon-entity-schema-contract", "derives", createdAt),
      this.makeRelation(wellId, "drop-canon-state-versioning-contract", "drop-canon-workdir-contract", "constrains", createdAt),
      this.makeRelation(wellId, "drop-canon-project-layer", "drop-canon-workdir-contract", "implements", createdAt),
      this.makeRelation(wellId, "drop-canon-generator-diff-contract", "drop-canon-v1-delivery", "constrains", createdAt),
      this.makeRelation(wellId, "drop-canon-asset-layering-contract", "drop-canon-ui-observability-contract", "constrains", createdAt),
      this.makeRelation(wellId, "drop-canon-relation-semantics-contract", "drop-canon-ui-observability-contract", "constrains", createdAt),
      this.makeRelation(wellId, "drop-canon-ui-observability-contract", "drop-canon-v1-delivery", "implements", createdAt),
      this.makeRelation(wellId, "drop-ref-mimikit-openai-llm", "drop-canon-v1-delivery", "references", createdAt),
      this.makeRelation(wellId, "drop-ref-react-19", "drop-canon-v1-delivery", "references", createdAt),
      this.makeRelation(wellId, "drop-ref-codex", "drop-canon-execution-protocol", "references", createdAt),
      this.makeRelation(wellId, "drop-ref-codex", "drop-canon-v1-delivery", "references", createdAt),
      this.makeRelation(wellId, "drop-ref-visualization-first", "drop-canon-v1-delivery", "references", createdAt),
      this.makeRelation(wellId, "drop-ref-engineering-execution", "drop-canon-execution-protocol", "references", createdAt),
      this.makeRelation(wellId, "drop-ref-engineering-execution", "drop-canon-v1-delivery", "references", createdAt),
    ];
  }

  getPacketRecords(): PacketRecord[] {
    return structuredClone(this.state.packetRecords);
  }

  setProject(project: ProjectState): WellState {
    this.state.project = project;
    return this.getState();
  }

  private buildGenerationDiff(): GenerationDiff {
    const baseline = this.state.candidates[0];
    const baselineCoverage = new Set(baseline?.coverageDropIds ?? []);
    const currentCoverage = new Set(this.state.drops.map((drop) => drop.dropId));
    const baselineRelations = new Set(baseline?.relationKeys ?? []);
    const currentRelations = new Set(this.state.relations.map((rel) => relationKey(rel)));
    const changedWellFields: ChangedWellField[] = [];

    if (this.state.pendingChangedDropIds.includes(this.state.well.originDropId ?? "")) {
      changedWellFields.push("goal-origin", "wish");
    }
    if (this.state.pendingChangedDropIds.includes(this.state.well.acceptanceDropId)) {
      changedWellFields.push("acceptance");
    }
    if (this.state.pendingChangedDropIds.length > 0) {
      changedWellFields.push("definition-of-done", "constraints");
    }

    return {
      baselineCandidateId: baseline?.candidateId,
      addedDropIds: [...currentCoverage].filter((dropId) => !baselineCoverage.has(dropId)),
      changedDropIds: [...this.state.pendingChangedDropIds],
      removedDropIds: [...baselineCoverage].filter((dropId) => !currentCoverage.has(dropId)),
      addedRelationKeys: [...currentRelations].filter((key) => !baselineRelations.has(key)),
      removedRelationKeys: [...baselineRelations].filter((key) => !currentRelations.has(key)),
      changedWellFields: [...new Set(changedWellFields)],
      relationDeltaCount:
        [...currentRelations].filter((key) => !baselineRelations.has(key)).length
        + [...baselineRelations].filter((key) => !currentRelations.has(key)).length,
      constraintChanged: changedWellFields.includes("constraints") || changedWellFields.includes("goal-origin"),
      acceptanceChanged: this.state.pendingChangedDropIds.includes(this.state.well.acceptanceDropId),
    };
  }

  setWish(input: { wish: string; definitionOfDone: string[]; constraints: string[] }): Well {
    return applyActionResult(this.state, setWishAction(this.state, input));
  }

  ensureGoalOriginDraft(): Drop {
    return applyActionResult(this.state, ensureGoalOriginDraftAction(this.state));
  }

  updateGoalOrigin(input: { title?: string; summary?: string; status?: "draft" | "confirmed" | "revised" }): Drop {
    return applyActionResult(this.state, updateGoalOriginAction(this.state, input));
  }

  ingestDrop(input: {
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
  }): Drop {
    return applyActionResult(this.state, ingestDropAction(this.state, input));
  }

  updateDrop(dropId: string, input: Partial<Pick<Drop, "summary" | "title" | "position">> & { skipAutoFlow?: boolean }): Drop {
    return applyActionResult(this.state, updateDropAction(this.state, dropId, input));
  }

  connectDrops(fromDropId: string, toDropId: string, relationType: RelationType = "references"): Relation {
    return applyActionResult(this.state, connectDropsAction(this.state, fromDropId, toDropId, relationType));
  }

  removeRelation(relationId: string): boolean {
    return applyActionResult(this.state, removeRelationAction(this.state, relationId));
  }

  setUnresolvedQuestions(questions: string[]): string[] {
    return applyActionResult(this.state, updateUnresolvedQuestionsAction(this.state, questions));
  }

  addConversationMessage(input: {
    content: string;
    dropId?: string;
    scope: "global" | "asset";
    role?: "user" | "system";
  }): ConversationMessage {
    const content = input.content.trim();
    if (!content) {
      throw new Error("conversation content is required");
    }
    const message: ConversationMessage = {
      messageId: `msg-${randomUUID().slice(0, 8)}`,
      dropId: input.dropId,
      scope: input.scope,
      role: input.role ?? "user",
      content,
      createdAt: nowIso(),
    };
    this.state.assetConversations.unshift(message);
    this.state.assetConversations = this.state.assetConversations.slice(0, 200);
    return structuredClone(message);
  }

  async runConversation(input: {
    content: string;
    dropId?: string;
    scope: "global" | "asset";
  }): Promise<{
    userMessage: ConversationMessage;
    systemMessage: ConversationMessage;
    analysis: ConversationAnalysis;
  }> {
    const userMessage = this.addConversationMessage({
      content: input.content,
      dropId: input.dropId,
      scope: input.scope,
      role: "user",
    });

    const analysis = await analyzeConversation(this.buildPacketContext({
      conversationPrompt: userMessage.content,
      conversationTargetDropId: input.dropId,
      unresolvedQuestions: deriveUnresolvedQuestions({
        drops: this.state.drops,
        definitionOfDone: this.state.well.definitionOfDone,
        acceptanceDropId: this.state.well.acceptanceDropId,
      }),
    }));

    const provenanceLine = analysis.outputSource === "fallback"
      ? "system reply source: fallback"
      : "system reply source: model";
    const systemMessage = this.addConversationMessage({
      content: [analysis.summary, provenanceLine].join("\n"),
      dropId: input.dropId,
      scope: input.scope,
      role: "system",
    });

    return {
      userMessage,
      systemMessage,
      analysis,
    };
  }

  getConversationMessages(dropId?: string): ConversationMessage[] {
    const items = dropId
      ? this.state.assetConversations.filter((message) => message.dropId === dropId || message.scope === "global")
      : this.state.assetConversations.filter((message) => message.scope === "global");
    return structuredClone(items);
  }

  private applyProposal(proposal: ChangeProposal): void {
    applyActionResult(this.state, applyProposalAction(this.state, proposal));
  }

  private buildProposal(packet: PacketRecord): ChangeProposal | undefined {
    return buildProposalFromPacket(packet);
  }

  private persistProposal(proposal: ChangeProposal): void {
    this.state.proposals.unshift(proposal);
    this.state.proposals = this.state.proposals.slice(0, 50);
  }

  getProposals(): ChangeProposal[] {
    return structuredClone(this.state.proposals);
  }

  applyProposalById(proposalId: string): ChangeProposal {
    const proposal = this.state.proposals.find((item) => item.proposalId === proposalId);
    if (!proposal) {
      throw new Error(`proposal not found: ${proposalId}`);
    }
    this.applyProposal(proposal);
    return structuredClone(proposal);
  }

  rejectProposalById(proposalId: string): ChangeProposal {
    const proposal = this.state.proposals.find((item) => item.proposalId === proposalId);
    if (!proposal) {
      throw new Error(`proposal not found: ${proposalId}`);
    }
    proposal.status = "rejected";
    proposal.rejectedAt = nowIso();
    this.pushRunLog({
      stage: "organize",
      status: "warn",
      summary: "proposal.rejected",
      payload: { proposalId },
    });
    return structuredClone(proposal);
  }

  private ensureIntentHypothesis(): void {
    applyActionResult(this.state, ensureIntentHypothesisAction(this.state));
  }

  private annotateConflicts(): void {
    applyActionResult(this.state, annotateConflictsAction(this.state));
  }

  private runHeuristicAnalyze(): void {
    applyActionResult(this.state, runHeuristicAnalyzeAction(this.state));
  }

  private runHeuristicOrganize(): void {
    applyActionResult(this.state, runHeuristicOrganizeAction(this.state));
  }

  private runHeuristicGapCheck(): void {
    applyActionResult(this.state, runHeuristicGapCheckAction(this.state));
  }

  private buildPacketContext(overrides: Partial<PacketContext> = {}): PacketContext {
    const visibleDrops = this.state.drops.filter((drop) => drop.lifecycleState !== "archived");
    const acceptanceDrop = visibleDrops.find((drop) => drop.dropId === this.state.well.acceptanceDropId);
    return {
      projectId: this.state.project.projectId,
      projectName: this.state.project.name,
      projectWorkdir: this.state.project.workdir,
      wellId: this.state.well.id,
      artifactType: this.state.well.artifactType,
      wish: this.state.well.wish,
      definitionOfDone: [...this.state.well.definitionOfDone],
      constraints: [...this.state.well.constraints],
      acceptanceDropId: this.state.well.acceptanceDropId,
      acceptanceSummary: acceptanceDrop?.summary,
      unresolvedQuestions: [...this.state.unresolvedQuestions],
      activeDropIds: visibleDrops.map((drop) => drop.dropId),
      activeDropSummaries: visibleDrops.map((drop) => ({
        dropId: drop.dropId,
        type: drop.type,
        title: drop.title,
        summary: drop.summary,
        priority: drop.priority,
        layer: drop.layer,
      })),
      latestCandidateId: this.state.candidates[0]?.candidateId,
      latestCandidateSummary: this.state.candidates[0]?.content.slice(0, 1000),
      latestPacketSummary: this.state.packetRecords[0]?.response.structured?.summary ?? this.state.packetRecords[0]?.response.summary,
      generationDiff: this.buildGenerationDiff(),
      ...overrides,
    };
  }

  async runPacketStage(stage: PacketStage, overrides: Partial<PacketContext> = {}): Promise<PacketRecord> {
    const record = await runPacket(stage, this.buildPacketContext(overrides));
    this.state.packetRecords.unshift(record);
    this.state.packetRecords = this.state.packetRecords.slice(0, 30);
    const proposal = this.buildProposal(record);
    if (proposal) {
      this.persistProposal(proposal);
    }
    this.pushRunLog({
      stage: stage === "gap-fill" ? "gap-fill" : stage,
      status: "pass",
      summary: `${stage}.packet.completed`,
      payload: {
        packetId: record.packetId,
        provider: record.response.provider,
        usedFallback: record.response.usedFallback,
      },
    });
    return structuredClone(record);
  }

  private async runTransientPacketStage(
    stage: PacketStage,
    overrides: Partial<PacketContext> = {},
  ): Promise<{ packet: PacketRecord }> {
    const packet = await runPacket(stage, this.buildPacketContext(overrides));
    return {
      packet: structuredClone(packet),
    };
  }

  async runDeepOrganize(trigger: string): Promise<{
    analyzePacket: PacketRecord;
    analyzeProposal?: ChangeProposal;
    gapFillPacket: PacketRecord;
    gapFillProposal?: ChangeProposal;
  }> {
    // Keep the local hypothesis/conflict layer current so packet context is stable,
    // but let the packet stages drive the actual organize decisions.
    this.ensureIntentHypothesis();
    this.annotateConflicts();
    this.state.well.status = "analyze";
    this.state.well.updatedAt = nowIso();

    const analyzePacket = await this.runPacketStage("analyze");
    const analyzeProposal = this.state.proposals.find((item) => item.sourcePacketId === analyzePacket.packetId);
    if (analyzeProposal?.status === "proposed" && analyzeProposal.gateStatus !== "fail") {
      this.applyProposal(analyzeProposal);
    }

    this.state.well.status = "gap-check";
    this.state.well.updatedAt = nowIso();
    const gapFillPacket = await this.runPacketStage("gap-fill");
    const gapFillProposal = this.state.proposals.find((item) => item.sourcePacketId === gapFillPacket.packetId);
    if (gapFillProposal?.status === "proposed" && gapFillProposal.gateStatus !== "fail") {
      this.applyProposal(gapFillProposal);
    }

    applyActionResult(this.state, runHeuristicOrganizeAction(this.state));
    this.applyMicroLifecycle();
    this.pushRunLog({
      stage: "organize",
      status: "pass",
      summary: `deep-organize.completed:${trigger}`,
      payload: {
        trigger,
        analyzePacketId: analyzePacket.packetId,
        analyzeProposalId: analyzeProposal?.proposalId ?? null,
        gapFillPacketId: gapFillPacket.packetId,
        gapFillProposalId: gapFillProposal?.proposalId ?? null,
      },
    });

    return {
      analyzePacket: structuredClone(analyzePacket),
      ...(analyzeProposal ? { analyzeProposal: structuredClone(analyzeProposal) } : {}),
      gapFillPacket: structuredClone(gapFillPacket),
      ...(gapFillProposal ? { gapFillProposal: structuredClone(gapFillProposal) } : {}),
    };
  }

  getMainLoopSnapshot(): MainLoopSnapshot {
    const latestProposal = this.state.proposals[0];
    const appliedProposal = this.state.proposals.find((proposal) => proposal.status === "applied");
    const latestVerify = this.state.verifyReports[0];
    const lastLog = this.state.runLogs[0];
    return {
      stageChain: ["asset", "proposal", "gate", "apply", "verify"],
      latestProposalId: latestProposal?.proposalId,
      latestProposalStatus: latestProposal?.status,
      latestProposalGate: latestProposal?.gateStatus,
      appliedProposalId: appliedProposal?.proposalId,
      latestCandidateId: this.state.candidates[0]?.candidateId,
      latestVerifyPass: latestVerify?.pass,
      lastRunAt: lastLog?.createdAt,
    };
  }

  runAutoFlow(trigger: string): DryRunReport {
    this.ensureIntentHypothesis();
    this.annotateConflicts();
    this.runHeuristicAnalyze();
    this.runHeuristicOrganize();
    this.runHeuristicGapCheck();
    this.applyMicroLifecycle();
    const report = this.runDryRun();
    this.pushRunLog({
      stage: "dry-run",
      status: report.gateResult,
      summary: `auto-flow.completed:${trigger}`,
      payload: { trigger, gateResult: report.gateResult },
    });
    return report;
  }

  applyMicroLifecycle(): MicroLifecycleSummary {
    return applyActionResult(this.state, applyMicroLifecycleAction(this.state));
  }

  runDryRun(): DryRunReport {
    this.state.well.status = "dry-run";
    const { checks, counters } = evaluateDryRun(this.state);

    let gateResult: DryRunStatus = "pass";
    let gateReason = "All checks pass within threshold.";

    if (
      counters.failCount >= 1 ||
      counters.criticalFailCount >= 1 ||
      counters.highConflictCount >= 1 ||
      counters.missingRequiredCapabilityCount >= 1
    ) {
      gateResult = "fail";
      gateReason = "Fail condition hit in quantified gate thresholds.";
    } else if (counters.criticalWarnCount >= 1 || counters.warnCount >= 2) {
      gateResult = "warn";
      gateReason = "Warn condition hit in quantified gate thresholds.";
    }

    const report: DryRunReport = {
      ...counters,
      gateResult,
      gateReason,
      checks,
      createdAt: nowIso(),
    };

    this.state.well.dryRunStatus = gateResult;
    this.state.well.dryRunReport = report;
    this.state.well.updatedAt = report.createdAt;

    this.pushRunLog({
      stage: "dry-run",
      status: gateResult,
      summary: `dry-run ${gateResult}`,
      payload: report as unknown as Record<string, unknown>,
    });

    return structuredClone(report);
  }

  async generateArtifact(): Promise<CandidateArtifact> {
    const report = this.state.well.dryRunReport ?? this.runDryRun();
    this.state.well.status = "generate";

    if (report.gateResult === "fail") {
      throw new Error("generate blocked: dry-run gate is fail");
    }

    const packet = await this.runPacketStage("generate");
    const proposal = this.state.proposals.find((item) => item.sourcePacketId === packet.packetId);
    if (!proposal) {
      throw new Error("generate failed: proposal not created");
    }
    if (proposal.gateStatus === "fail") {
      throw new Error(`generate blocked: proposal gate fail (${proposal.gateReasons.join("; ")})`);
    }
    const previousCandidate = this.state.candidates[0];
    const diff = packet.request.context.generationDiff;
    const candidate = buildCandidateArtifact(this.state, packet);

    this.state.candidates.unshift(candidate);

    this.pushRunLog({
      stage: "generate",
      status: report.gateResult,
      summary: `generated ${candidate.candidateId}`,
      payload: {
        candidateId: candidate.candidateId,
        packetId: packet.packetId,
        proposalId: proposal.proposalId,
        baselineCandidateId: previousCandidate?.candidateId ?? null,
        generationMode: previousCandidate ? "incremental" : "initial",
        changedDropIds: diff?.changedDropIds ?? [],
        addedDropIds: diff?.addedDropIds ?? [],
        removedDropIds: diff?.removedDropIds ?? [],
      },
    });

    return structuredClone(candidate);
  }

  async verifyLatest(): Promise<VerifyReport> {
    this.state.well.status = "verify";

    const candidate = this.state.candidates[0];
    if (!candidate) {
      throw new Error("verify failed: no candidate artifact");
    }

    const report = this.state.well.dryRunReport ?? this.runDryRun();
    const packet = await this.runPacketStage("verify");
    const proposal = this.state.proposals.find((item) => item.sourcePacketId === packet.packetId);
    if (!proposal) {
      throw new Error("verify failed: proposal not created");
    }
    if (proposal.gateStatus === "fail") {
      throw new Error(`verify blocked: proposal gate fail (${proposal.gateReasons.join("; ")})`);
    }
    const verifyReport = buildVerifyReport({
      state: this.state,
      packetId: packet.packetId,
      dryRunReport: report,
    });

    this.state.verifyReports.unshift(verifyReport);

    const priorityRecommendations = evaluatePriorityLifecycle(this.state);
    const priorityLifecycleAudits = this.applyPriorityLifecycleRecommendations(priorityRecommendations);
    const routeExecution = await this.executeVerifyRoute(
      pickVerifyRoute(verifyReport, report.gateResult, this.state.unresolvedQuestions.length),
    );
    const cycle = buildVerifyCycle({
      state: this.state,
      report: verifyReport,
      priorityRecommendations,
      priorityLifecycleAudits,
      routeExecution,
    });
    this.state.verifyCycles.unshift(cycle);
    if (cycle.overrideNeeded) {
      this.state.runLogs.unshift({
        runId: `run-${randomUUID().slice(0, 8)}`,
        stage: "verify",
        status: "warn",
        summary: `override-needed ${cycle.overrideType ?? "unknown"}`,
        payload: cycle as unknown as Record<string, unknown>,
        createdAt: nowIso(),
      });
    }

    this.pushRunLog({
      stage: "verify",
      status: verifyReport.pass ? "pass" : "fail",
      summary: verifyReport.pass ? "verify pass" : "verify fail",
      payload: verifyReport as unknown as Record<string, unknown>,
    });

    const selfIterationRecord = buildSelfIterationRecord({
      cycleId: cycle.cycleId,
      state: this.state,
      report: verifyReport,
      dryRunGate: report.gateResult,
    });
    this.state.selfIterationRecords.unshift(selfIterationRecord);
    this.state.selfIterationRecords = this.state.selfIterationRecords.slice(0, 20);
    this.state.pendingChangedDropIds = [];

    return structuredClone(verifyReport);
  }

  async runCycle(): Promise<{ dryRun: DryRunReport; candidate?: CandidateArtifact; verify?: VerifyReport; error?: string }> {
    const dryRun = this.runDryRun();
    if (dryRun.gateResult === "fail") {
      return { dryRun, error: "dry-run gate is fail; cycle halted" };
    }
    try {
      const candidate = await this.generateArtifact();
      const verify = await this.verifyLatest();
      this.pushRunLog({
        stage: "verify",
        status: verify.pass ? "pass" : "warn",
        summary: "main-loop.completed",
        payload: this.getMainLoopSnapshot() as unknown as Record<string, unknown>,
      });
      return { dryRun, candidate, verify };
    } catch (error) {
      return { dryRun, error: String((error as Error).message) };
    }
  }

  private pushRunLog(input: {
    stage: RunLog["stage"];
    status: RunLog["status"];
    summary: string;
    payload: Record<string, unknown>;
  }): void {
    const runLog: RunLog = {
      runId: `run-${randomUUID().slice(0, 8)}`,
      stage: input.stage,
      status: input.status,
      summary: input.summary,
      payload: input.payload,
      createdAt: nowIso(),
    };
    this.state.runLogs.unshift(runLog);
    this.state.runLogs = this.state.runLogs.slice(0, 50);
  }
}
