import type {
  AssetDomain,
  AssetLayer,
  AssetOwner,
  AssetScope,
  AssetSource,
  AssetType,
  CatalogAsset,
  Priority,
  RelationType,
  SchemaValidationIssue,
  SchemaValidationReport,
  WellState,
} from "./types.js";
import { migrateToLatest } from "./state-migrations.js";
import {
  getSchemaValidationReport as getSchemaValidationReportFromService,
  validateCatalogAssetSchema,
} from "./state-schema-service.js";
export {
  getSchemaManifest,
  getSchemaValidationReport,
} from "./state-schema-service.js";
export {
  validateAutoFlowInput,
  validateAssistantLoopInput,
  validateAcceptDirectionInput,
  validateCreateDropInput,
  validateGoalInput,
  validatePacketStage,
  validateProjectCreateInput,
  validateQuestionsInput,
  validateRelationInput,
  validateUpdateDropInput,
  validateWishInput,
} from "./input-validator.js";

const ASSET_TYPES = new Set<AssetType>([
  "canonical-bundle",
  "reference-project",
  "reference-tech",
  "reference-tool",
  "reference-principle",
  "reference-engineering",
  "goal-origin",
  "generated-intent-hypothesis",
  "generated-gap",
  "note",
  "doc",
  "url",
  "image",
  "generated",
]);
const ASSET_DOMAINS = new Set<AssetDomain>(["core", "protocol", "delivery", "reference", "legacy"]);
const ASSET_SCOPES = new Set<AssetScope>(["well-global", "run-local"]);
const ASSET_SOURCES = new Set<AssetSource>(["docs", "ai-generated", "user"]);
const ASSET_LAYERS = new Set<AssetLayer>(["contract", "policy", "reference"]);
const ASSET_OWNERS = new Set<AssetOwner>([
  "product-core",
  "orchestrator-core",
  "delivery-core",
  "architecture-core",
  "webui-core",
  "engineering-core",
  "ux-core",
  "user",
]);
const PRIORITIES = new Set<Priority>(["p0", "p1", "p2"]);
const RELATION_TYPES = new Set<RelationType>(["constrains", "supports", "references", "derives", "implements"]);

function ensure(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeOwner(drop: Record<string, unknown>): AssetOwner {
  const raw = drop.owner;
  if (typeof raw === "string" && ASSET_OWNERS.has(raw as AssetOwner)) {
    return raw as AssetOwner;
  }
  if (drop.source === "user") {
    return "user";
  }
  if (drop.type === "goal-origin") {
    return "product-core";
  }
  if (drop.type === "generated-intent-hypothesis") {
    return "orchestrator-core";
  }
  if (drop.type === "generated-gap") {
    return "delivery-core";
  }
  if (drop.domain === "reference") {
    return "architecture-core";
  }
  if (drop.domain === "protocol") {
    return "orchestrator-core";
  }
  if (drop.domain === "delivery") {
    return "delivery-core";
  }
  return "product-core";
}

function ensureString(value: unknown, label: string): string {
  ensure(typeof value === "string" && value.trim().length > 0, `${label} must be a non-empty string`);
  return value as string;
}

function ensureStringArray(value: unknown, label: string): string[] {
  ensure(Array.isArray(value) && value.every((item) => typeof item === "string"), `${label} must be a string array`);
  return value as string[];
}

function validateDropEntity(drop: Record<string, unknown>): void {
  ensureString(drop.dropId, "drop.dropId");
  ensureString(drop.wellId, "drop.wellId");
  ensure(ASSET_TYPES.has(drop.type as AssetType), `drop has invalid type: ${String(drop.dropId ?? "unknown")}`);
  ensure(ASSET_DOMAINS.has(drop.domain as AssetDomain), `drop has invalid domain: ${String(drop.dropId ?? "unknown")}`);
  ensure(ASSET_SCOPES.has(drop.scope as AssetScope), `drop has invalid scope: ${String(drop.dropId ?? "unknown")}`);
  ensure(ASSET_SOURCES.has(drop.source as AssetSource), `drop has invalid source: ${String(drop.dropId ?? "unknown")}`);
  ensure(ASSET_OWNERS.has(drop.owner as AssetOwner), `drop has invalid owner: ${String(drop.dropId ?? "unknown")}`);
  ensure(ASSET_LAYERS.has(drop.layer as AssetLayer), `drop has invalid layer: ${String(drop.dropId ?? "unknown")}`);
  ensureString(drop.title, `drop.title:${String(drop.dropId ?? "unknown")}`);
  ensureString(drop.summary, `drop.summary:${String(drop.dropId ?? "unknown")}`);
  ensure(PRIORITIES.has(drop.priority as Priority), `drop has invalid priority: ${String(drop.dropId ?? "unknown")}`);
  ensure(typeof drop.confidence === "number" && Number.isFinite(drop.confidence), `drop has invalid confidence: ${String(drop.dropId ?? "unknown")}`);
  ensure(
    drop.licenseState === "known" || drop.licenseState === "unknown" || drop.licenseState === "restricted",
    `drop has invalid licenseState: ${String(drop.dropId ?? "unknown")}`,
  );
  ensureString(drop.createdAt, `drop.createdAt:${String(drop.dropId ?? "unknown")}`);
  ensureString(drop.updatedAt, `drop.updatedAt:${String(drop.dropId ?? "unknown")}`);
  if (drop.position !== undefined) {
    ensure(isObject(drop.position), `drop.position must be an object: ${String(drop.dropId ?? "unknown")}`);
    const position = drop.position as Record<string, unknown>;
    ensure(typeof position.x === "number" && Number.isFinite(position.x), `drop.position.x invalid: ${String(drop.dropId ?? "unknown")}`);
    ensure(typeof position.y === "number" && Number.isFinite(position.y), `drop.position.y invalid: ${String(drop.dropId ?? "unknown")}`);
  }
}

function validateRelationEntity(relation: Record<string, unknown>): void {
  ensureString(relation.relationId, "relation.relationId");
  ensureString(relation.wellId, "relation.wellId");
  ensureString(relation.fromDropId, "relation.fromDropId");
  ensureString(relation.toDropId, "relation.toDropId");
  ensure(RELATION_TYPES.has(relation.relationType as RelationType), `relation has invalid type: ${String(relation.relationId ?? "unknown")}`);
  ensureString(relation.createdAt, `relation.createdAt:${String(relation.relationId ?? "unknown")}`);
}

function validateCandidateEntity(candidate: Record<string, unknown>): void {
  ensureString(candidate.candidateId, "candidate.candidateId");
  ensureString(candidate.wellId, "candidate.wellId");
  ensureString(candidate.content, `candidate.content:${String(candidate.candidateId ?? "unknown")}`);
  ensureStringArray(candidate.coverageDropIds, `candidate.coverageDropIds:${String(candidate.candidateId ?? "unknown")}`);
  if (candidate.relationKeys !== undefined) {
    ensureStringArray(candidate.relationKeys, `candidate.relationKeys:${String(candidate.candidateId ?? "unknown")}`);
  }
  ensureString(candidate.createdAt, `candidate.createdAt:${String(candidate.candidateId ?? "unknown")}`);
}

function validatePacketRecordEntity(packet: Record<string, unknown>): void {
  ensureString(packet.packetId, "packet.packetId");
  ensure(
    packet.stage === "analyze" || packet.stage === "gap-fill" || packet.stage === "generate" || packet.stage === "verify",
    `packet has invalid stage: ${String(packet.packetId ?? "unknown")}`,
  );
  ensure(isObject(packet.request), `packet.request invalid: ${String(packet.packetId ?? "unknown")}`);
  ensure(isObject(packet.response), `packet.response invalid: ${String(packet.packetId ?? "unknown")}`);
  const response = packet.response as Record<string, unknown>;
  ensureString(response.provider, `packet.response.provider:${String(packet.packetId ?? "unknown")}`);
  ensureString(response.model, `packet.response.model:${String(packet.packetId ?? "unknown")}`);
  ensure(typeof response.usedFallback === "boolean", `packet.response.usedFallback invalid:${String(packet.packetId ?? "unknown")}`);
  ensure(response.outputSource === "model" || response.outputSource === "fallback", `packet.response.outputSource invalid:${String(packet.packetId ?? "unknown")}`);
  ensureString(response.summary, `packet.response.summary:${String(packet.packetId ?? "unknown")}`);
  ensureString(response.outputText, `packet.response.outputText:${String(packet.packetId ?? "unknown")}`);
  ensure(Array.isArray(response.evidence) && response.evidence.every((item) => typeof item === "string"), `packet.response.evidence invalid:${String(packet.packetId ?? "unknown")}`);
  if (response.structured !== undefined) {
    ensure(isObject(response.structured), `packet.response.structured invalid:${String(packet.packetId ?? "unknown")}`);
    const structured = response.structured as Record<string, unknown>;
    ensureString(structured.summary, `packet.response.structured.summary:${String(packet.packetId ?? "unknown")}`);
    if (structured.changedDropIds !== undefined) {
      ensureStringArray(structured.changedDropIds, `packet.response.structured.changedDropIds:${String(packet.packetId ?? "unknown")}`);
    }
    if (structured.issues !== undefined) {
      ensureStringArray(structured.issues, `packet.response.structured.issues:${String(packet.packetId ?? "unknown")}`);
    }
    if (structured.suggestions !== undefined) {
      ensureStringArray(structured.suggestions, `packet.response.structured.suggestions:${String(packet.packetId ?? "unknown")}`);
    }
    if (structured.outputSource !== undefined) {
      ensure(structured.outputSource === "model" || structured.outputSource === "fallback", `packet.response.structured.outputSource invalid:${String(packet.packetId ?? "unknown")}`);
    }
    if (structured.provenanceNotes !== undefined) {
      ensureStringArray(structured.provenanceNotes, `packet.response.structured.provenanceNotes:${String(packet.packetId ?? "unknown")}`);
    }
  }
  ensureString(packet.createdAt, `packet.createdAt:${String(packet.packetId ?? "unknown")}`);
}

function validateVerifyReportEntity(report: Record<string, unknown>): void {
  ensure(typeof report.pass === "boolean", "verifyReport.pass must be boolean");
  ensureStringArray(report.issues, "verifyReport.issues");
  ensureStringArray(report.suggestions, "verifyReport.suggestions");
  ensureStringArray(report.acceptanceCoverageDropIds, "verifyReport.acceptanceCoverageDropIds");
  ensure(Array.isArray(report.acceptanceItems), "verifyReport.acceptanceItems must be array");
  ensure(Array.isArray(report.changedDropCoverage), "verifyReport.changedDropCoverage must be array");
  ensureStringArray(report.uncoveredAcceptanceItemIds, "verifyReport.uncoveredAcceptanceItemIds");
  ensureStringArray(report.selfIterationEvidence, "verifyReport.selfIterationEvidence");
  ensureStringArray(report.changedDropIds, "verifyReport.changedDropIds");
  ensure(typeof report.rerunConsistent === "boolean", "verifyReport.rerunConsistent must be boolean");
  ensureString(report.createdAt, "verifyReport.createdAt");
}

export function validateCatalogAsset(asset: CatalogAsset): CatalogAsset {
  ensure(Boolean(asset.dropId), "catalog asset missing dropId");
  ensure(ASSET_TYPES.has(asset.type), `catalog asset has invalid type: ${asset.dropId}`);
  ensure(ASSET_DOMAINS.has(asset.domain), `catalog asset has invalid domain: ${asset.dropId}`);
  ensure(ASSET_SCOPES.has(asset.scope), `catalog asset has invalid scope: ${asset.dropId}`);
  ensure(ASSET_OWNERS.has(asset.owner), `catalog asset has invalid owner: ${asset.dropId}`);
  ensure(ASSET_LAYERS.has(asset.layer), `catalog asset has invalid layer: ${asset.dropId}`);
  ensure(PRIORITIES.has(asset.priority), `catalog asset has invalid priority: ${asset.dropId}`);
  ensure(Boolean(asset.title), `catalog asset missing title: ${asset.dropId}`);
  ensure(Boolean(asset.summary), `catalog asset missing summary: ${asset.dropId}`);
  ensure(Boolean(asset.sourceFile), `catalog asset missing sourceFile: ${asset.dropId}`);
  validateCatalogAssetSchema(asset);
  return asset;
}

export function normalizeAndValidateState(state: WellState): WellState {
  migrateToLatest(state);
  const mutableState = state as unknown as Record<string, unknown>;
  if (!Array.isArray(mutableState.proposals)) {
    mutableState.proposals = [];
  }
  if (!Array.isArray(mutableState.verifyReports)) {
    mutableState.verifyReports = [];
  }
  if (!Array.isArray(mutableState.verifyCycles)) {
    mutableState.verifyCycles = [];
  }
  if (!Array.isArray(mutableState.selfIterationRecords)) {
    mutableState.selfIterationRecords = [];
  }
  if (!Array.isArray(mutableState.packetRecords)) {
    mutableState.packetRecords = [];
  }
  if (!Array.isArray(mutableState.pendingChangedDropIds)) {
    mutableState.pendingChangedDropIds = [];
  }
  if (!Array.isArray(mutableState.runLogs)) {
    mutableState.runLogs = [];
  }
  if (!Array.isArray(mutableState.unresolvedQuestions)) {
    mutableState.unresolvedQuestions = [];
  }
  if (!Array.isArray(mutableState.assetConversations)) {
    mutableState.assetConversations = [];
  }
  if (!Array.isArray(mutableState.automationTasks)) {
    mutableState.automationTasks = [];
  }
  if (!isObject(mutableState.assistantLoop)) {
    mutableState.assistantLoop = {
      status: "idle",
      userState: "needs-input",
      statusLabel: "Idle",
      summary: "Add material to begin the assistant loop.",
      nextAction: {
        key: "add-material",
        label: "Add material",
        detail: "Drop source material so the assistant has something concrete to work with.",
      },
      updatedAt: new Date().toISOString(),
    };
  }
  ensure(Boolean(state.project?.projectId), "state missing project.projectId");
  ensure(Boolean(state.well?.id), "state missing well.id");
  if ((state.well as unknown as Record<string, unknown>).acceptanceStatus !== "pending"
    && (state.well as unknown as Record<string, unknown>).acceptanceStatus !== "accepted") {
    (state.well as unknown as Record<string, unknown>).acceptanceStatus = "pending";
  }
  ensure(Array.isArray(state.drops), "state missing drops");
  ensure(Array.isArray(state.relations), "state missing relations");
  ensure(Array.isArray(state.candidates), "state missing candidates");
  ensure(Array.isArray(state.proposals), "state missing proposals");
  ensure(Array.isArray(state.verifyReports), "state missing verifyReports");
  ensure(Array.isArray(state.verifyCycles), "state missing verifyCycles");
  ensure(Array.isArray(state.selfIterationRecords), "state missing selfIterationRecords");
  ensure(Array.isArray(state.packetRecords), "state missing packetRecords");
  ensure(Array.isArray(state.pendingChangedDropIds), "state missing pendingChangedDropIds");
  ensure(Array.isArray(state.runLogs), "state missing runLogs");
  ensure(Array.isArray(state.unresolvedQuestions), "state missing unresolvedQuestions");
  ensure(Array.isArray(state.assetConversations), "state missing assetConversations");
  ensure(Array.isArray(state.automationTasks), "state missing automationTasks");
  ensure(isObject(state.assistantLoop), "state missing assistantLoop");

  for (const drop of state.drops) {
    const mutable = drop as unknown as Record<string, unknown>;
    if (!mutable.owner) {
      mutable.owner = normalizeOwner(mutable);
    }
    if (!mutable.layer || !ASSET_LAYERS.has(mutable.layer as AssetLayer)) {
      mutable.layer = typeof mutable.type === "string" && mutable.type.startsWith("reference-") ? "reference" : "contract";
    }
    if (!mutable.source || !ASSET_SOURCES.has(mutable.source as AssetSource)) {
      mutable.source = "ai-generated";
    }
    if (!mutable.scope || !ASSET_SCOPES.has(mutable.scope as AssetScope)) {
      mutable.scope = "run-local";
    }
    if (!mutable.domain || !ASSET_DOMAINS.has(mutable.domain as AssetDomain)) {
      mutable.domain = "delivery";
    }
    if (!mutable.type || !ASSET_TYPES.has(mutable.type as AssetType)) {
      mutable.type = "generated";
    }
    if (!mutable.priority || !PRIORITIES.has(mutable.priority as Priority)) {
      mutable.priority = "p2";
    }
    validateDropEntity(mutable);
  }

  for (const rel of state.relations) {
    const mutable = rel as unknown as Record<string, unknown>;
    if (!mutable.relationType || !RELATION_TYPES.has(mutable.relationType as RelationType)) {
      mutable.relationType = "references";
    }
    validateRelationEntity(mutable);
  }

  for (const candidate of state.candidates) {
    validateCandidateEntity(candidate as unknown as Record<string, unknown>);
  }
  for (const packet of state.packetRecords) {
    const mutable = packet as unknown as Record<string, unknown>;
    if (isObject(mutable.response)) {
      const response = mutable.response as Record<string, unknown>;
      if (response.outputSource !== "model" && response.outputSource !== "fallback") {
        response.outputSource = response.usedFallback === true ? "fallback" : "model";
      }
      if (isObject(response.structured)) {
        const structured = response.structured as Record<string, unknown>;
        if (structured.outputSource !== "model" && structured.outputSource !== "fallback") {
          structured.outputSource = response.outputSource;
        }
        if (!Array.isArray(structured.provenanceNotes)) {
          structured.provenanceNotes = [];
        }
      }
    }
    validatePacketRecordEntity(mutable);
  }
  for (const report of state.verifyReports) {
    validateVerifyReportEntity(report as unknown as Record<string, unknown>);
  }
  for (const proposal of state.proposals) {
    ensure(isObject(proposal), "proposal invalid");
    const mutable = proposal as unknown as Record<string, unknown>;
    if (!Array.isArray(mutable.assetPatches)) {
      mutable.assetPatches = [];
    }
    if (!Array.isArray(mutable.relationPatches)) {
      mutable.relationPatches = [];
    }
    if (!Array.isArray(mutable.issues)) {
      mutable.issues = [];
    }
    if (!Array.isArray(mutable.suggestions)) {
      mutable.suggestions = [];
    }
    if (!Array.isArray(mutable.changedDropIds)) {
      mutable.changedDropIds = [];
    }
    if (!Array.isArray(mutable.acceptanceCoverageDropIds)) {
      mutable.acceptanceCoverageDropIds = [];
    }
    if (mutable.status !== "proposed" && mutable.status !== "applied" && mutable.status !== "rejected") {
      mutable.status = "proposed";
    }
    if (mutable.gateStatus !== "pass" && mutable.gateStatus !== "warn" && mutable.gateStatus !== "fail") {
      mutable.gateStatus = "warn";
    }
    if (!Array.isArray(mutable.gateReasons)) {
      mutable.gateReasons = [];
    }
    if (typeof mutable.qualityScore !== "number" || !Number.isFinite(mutable.qualityScore)) {
      mutable.qualityScore = 20;
    }
    if (mutable.priority !== "critical" && mutable.priority !== "high" && mutable.priority !== "medium" && mutable.priority !== "low") {
      mutable.priority = "medium";
    }
    if (
      mutable.category !== "asset-change"
      && mutable.category !== "relation-change"
      && mutable.category !== "verification-remediation"
      && mutable.category !== "artifact-update"
      && mutable.category !== "mixed"
    ) {
      mutable.category = "verification-remediation";
    }
    ensureString(mutable.proposalId, "proposal.proposalId");
    ensureString(mutable.sourcePacketId, "proposal.sourcePacketId");
    ensureString(mutable.summary, "proposal.summary");
    ensureString(mutable.createdAt, "proposal.createdAt");
  }
  ensureStringArray(state.pendingChangedDropIds, "state.pendingChangedDropIds");
  ensureStringArray(state.unresolvedQuestions, "state.unresolvedQuestions");
  (state as unknown as Record<string, unknown>).schemaVersion = "1.1.0";
  const stateReport = getSchemaValidationReportFromService(state, []);
  ensure(stateReport.pass, `state schema validation failed: ${stateReport.issues.map((issue) => `${issue.instancePath} ${issue.message}`).join("; ")}`);
  return state;
}

 
