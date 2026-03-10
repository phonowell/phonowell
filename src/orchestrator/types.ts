export type Priority = "p0" | "p1" | "p2";
export type SchemaVersion = "1.0.0" | "1.1.0";
export type AssetOwner =
  | "product-core"
  | "orchestrator-core"
  | "delivery-core"
  | "architecture-core"
  | "webui-core"
  | "engineering-core"
  | "ux-core"
  | "user";
export type AssetType =
  | "canonical-bundle"
  | "reference-project"
  | "reference-tech"
  | "reference-tool"
  | "reference-principle"
  | "reference-engineering"
  | "goal-origin"
  | "generated-intent-hypothesis"
  | "generated-gap"
  | "note"
  | "doc"
  | "url"
  | "image"
  | "generated";
export type AssetDomain = "core" | "protocol" | "delivery" | "reference" | "legacy";
export type AssetScope = "well-global" | "run-local";
export type AssetSource = "docs" | "ai-generated" | "user";
export type AssetLayer = "contract" | "policy" | "reference";
export type RelationType = "constrains" | "supports" | "references" | "derives" | "implements";
export type ChangedWellField =
  | "wish"
  | "definition-of-done"
  | "constraints"
  | "goal-origin"
  | "acceptance";

export type WellStatus =
  | "goal-origin-init"
  | "chat-intake"
  | "ingest"
  | "first-principles-modeling"
  | "conflict-annotate"
  | "analyze"
  | "organize"
  | "gap-check"
  | "dry-run"
  | "generate"
  | "verify";

export type DryRunStatus = "pass" | "warn" | "fail";
export type ApprovalClass = "auto-apply" | "review-required" | "user-only";
export type AssistantLoopStatus = "idle" | "running" | "blocked" | "complete" | "failed";
export type AssistantLoopUserState = "ready" | "needs-input" | "risk-found" | "evidence-attached";
export type AssistantLoopActionKey =
  | "add-material"
  | "confirm-goal"
  | "continue-loop"
  | "review-checkpoint"
  | "accept-direction";

export type LifecycleState = "candidate" | "promoted" | "archived";

export type PacketStage = "analyze" | "gap-fill" | "generate" | "verify";
export type PacketOutputSource = "model" | "fallback";

export interface ProjectSummary {
  projectId: string;
  name: string;
  slug: string;
  workdir: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectState extends ProjectSummary {
  deletedAt?: string;
}

export interface Well {
  id: string;
  artifactType: string;
  wish: string;
  definitionOfDone: string[];
  constraints: string[];
  originDropId?: string;
  acceptanceDropId: string;
  acceptanceStatus: "pending" | "accepted";
  acceptedCandidateId?: string;
  acceptedAt?: string;
  status: WellStatus;
  dryRunStatus: DryRunStatus;
  dryRunReport?: DryRunReport;
  createdAt: string;
  updatedAt: string;
}

export interface Drop {
  dropId: string;
  wellId: string;
  type: AssetType;
  domain: AssetDomain;
  scope: AssetScope;
  source: AssetSource;
  owner: AssetOwner;
  layer: AssetLayer;
  title: string;
  summary: string;
  purpose?: string;
  content?: string;
  sourceFile?: string;
  priority: Priority;
  confidence: number;
  licenseState: "known" | "unknown" | "restricted";
  lifecycleState?: LifecycleState;
  parentDropId?: string;
  tags?: string[];
  goalStatus?: "draft" | "confirmed" | "revised";
  acceptanceTraceLinks?: AcceptanceTraceLink[];
  position?: { x: number; y: number };
  createdAt: string;
  updatedAt: string;
}

export interface Relation {
  relationId: string;
  wellId: string;
  fromDropId: string;
  toDropId: string;
  relationType: RelationType;
  createdAt: string;
}

export interface DryRunCheck {
  name:
    | "closure"
    | "acceptance"
    | "self-iteration"
    | "completeness"
    | "conflict"
    | "reuse-first"
    | "reverse-validation"
    | "asset-clarity"
    | "design-health";
  status: DryRunStatus;
  critical: boolean;
  evidence: string[];
}

export interface DryRunReport {
  checkTotal: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  criticalWarnCount: number;
  criticalFailCount: number;
  highConflictCount: number;
  missingRequiredCapabilityCount: number;
  acceptanceUnboundCount: number;
  acceptanceUncheckableCount: number;
  selfIterationEvidencePathMissingCount: number;
  assetUnclearCount: number;
  assetMissingPurposeCount: number;
  assetOrphanCount: number;
  designOverlapCount: number;
  designContradictionCount: number;
  designRedundancyCount: number;
  designErrorCount: number;
  designLowRoiCount: number;
  gateResult: DryRunStatus;
  gateReason: string;
  checks: DryRunCheck[];
  createdAt: string;
}

export interface CandidateArtifact {
  candidateId: string;
  wellId: string;
  content: string;
  coverageDropIds: string[];
  relationKeys?: string[];
  wishSnapshot?: string;
  definitionOfDoneSnapshot?: string[];
  constraintsSnapshot?: string[];
  acceptanceDropIdSnapshot?: string;
  packetId?: string;
  createdAt: string;
}

export interface AcceptanceEvidence {
  kind: "drop" | "relation" | "run-log" | "packet" | "candidate";
  ref: string;
  detail: string;
  source: "manual-link" | "proposal-link" | "heuristic-link" | "system-rule";
}

export interface AcceptanceTraceLink {
  itemId: string;
  source: AcceptanceEvidence["source"];
  rationale?: string;
  evidence: AcceptanceEvidence[];
}

export interface AcceptanceCoverageEntry {
  itemId: string;
  title: string;
  source: "definition-of-done" | "acceptance-contract";
  status: "covered" | "uncovered";
  coveredByDropIds: string[];
  evidence: AcceptanceEvidence[];
  confidence: number;
  uncoveredReason?: string;
}

export interface ChangedDropAcceptanceCoverage {
  dropId: string;
  acceptanceItemIds: string[];
  evidence: AcceptanceEvidence[];
}

export interface VerifyReport {
  pass: boolean;
  issues: string[];
  suggestions: string[];
  acceptanceCoverageDropIds: string[];
  acceptanceItems: AcceptanceCoverageEntry[];
  changedDropCoverage: ChangedDropAcceptanceCoverage[];
  uncoveredAcceptanceItemIds: string[];
  selfIterationEvidence: string[];
  changedDropIds: string[];
  rerunConsistent: boolean;
  packetId?: string;
  createdAt: string;
}

export interface PriorityLifecycleAuditRecord {
  dropId: string;
  from: Priority;
  to: Priority;
  reason: string;
  decision: "applied" | "deferred";
  overrideRequired: boolean;
  evidence: string[];
  createdAt: string;
}

export interface VerifyRouteExecution {
  route: "gap-check" | "analyze" | "regenerate";
  executed: boolean;
  status: "pass" | "warn" | "fail";
  actions: string[];
  evidence: string[];
  createdAt: string;
}

export interface VerifyCycleRecord {
  cycleId: string;
  wellId: string;
  verifyRoute: "gap-check" | "analyze" | "regenerate";
  verifyRouteEvidence: string[];
  priorityRecommendations: Array<{ dropId: string; from: Priority; to: Priority; reason: string }>;
  priorityLifecycleAudits?: PriorityLifecycleAuditRecord[];
  routeExecution?: VerifyRouteExecution;
  overrideNeeded: boolean;
  overrideType?: "verify-routing" | "priority-lifecycle";
  overrideReason?: string;
}

export interface MicroLifecycleSummary {
  promoted: string[];
  archived: string[];
  untouched: string[];
  createdAt: string;
}

export interface RunLog {
  runId: string;
  stage: "assistant-loop" | "intake" | "ingest" | "modeling" | "conflict" | "analyze" | "organize" | "gap-fill" | "dry-run" | "generate" | "verify";
  status: "pass" | "warn" | "fail";
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ConversationMessage {
  messageId: string;
  dropId?: string;
  scope: "global" | "asset";
  role: "user" | "system";
  content: string;
  createdAt: string;
}

export interface ConversationAnalysis {
  summary: string;
  outputSource: PacketOutputSource;
  provenanceNotes: string[];
}

export interface SelfIterationRecord {
  cycleId: string;
  changedDropIds: string[];
  acceptanceCoverageDropIds: string[];
  rerunConsistent: boolean;
  dryRunGate: DryRunStatus;
  verifyPass: boolean;
  stateHash: string;
  createdAt: string;
}

export interface PacketContext {
  projectId: string;
  projectName: string;
  projectWorkdir: string;
  wellId: string;
  artifactType: string;
  wish: string;
  definitionOfDone: string[];
  constraints: string[];
  acceptanceDropId?: string;
  acceptanceSummary?: string;
  unresolvedQuestions: string[];
  activeDropIds: string[];
  activeDropSummaries?: Array<{ dropId: string; type: AssetType; title: string; summary: string; priority: Priority; layer: AssetLayer }>;
  latestCandidateId?: string;
  latestCandidateSummary?: string;
  latestPacketSummary?: string;
  generationDiff?: GenerationDiff;
  conversationPrompt?: string;
  conversationTargetDropId?: string;
}

export interface AutomationDecision {
  decisionId: string;
  kind: "summary" | "layer" | "domain" | "priority" | "relation" | "conflict" | "preflight";
  source: "heuristic" | "model-assisted" | "system-rule";
  approvalClass: ApprovalClass;
  targetDropId?: string;
  proposedValue: string;
  confidence: number;
  applied: boolean;
  evidence: string[];
  appliedReason?: string;
  deferredReason?: string;
  createdAt: string;
}

export interface AutomationStepRecord {
  step: "summarize" | "candidate-metadata" | "relations" | "conflicts" | "preflight";
  status: "pending" | "completed" | "skipped" | "failed";
  evidence: string[];
  decisionIds: string[];
}

export interface AutomationTaskRecord {
  taskId: string;
  kind: "post-ingest-organize";
  trigger: string;
  sourceDropId: string;
  status: "pending" | "running" | "completed" | "failed";
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  steps: AutomationStepRecord[];
  decisions: AutomationDecision[];
  error?: string;
}

export interface PacketRequest {
  packetId: string;
  stage: PacketStage;
  instruction: string;
  context: PacketContext;
  createdAt: string;
}

export interface PacketAssetPatch {
  action: "add" | "update" | "archive";
  dropId?: string;
  type?: AssetType;
  title: string;
  summary: string;
  purpose?: string;
  domain?: AssetDomain;
  scope?: AssetScope;
  owner?: AssetOwner;
  layer?: AssetLayer;
  priority?: Priority;
  parentDropId?: string;
}

export interface PacketRelationPatch {
  action: "add" | "remove";
  fromDropId: string;
  toDropId: string;
  relationType: RelationType;
}

export interface PacketStructuredOutput {
  summary: string;
  artifactContent?: string;
  issues?: string[];
  suggestions?: string[];
  changedDropIds?: string[];
  acceptanceCoverageDropIds?: string[];
  assetPatches?: PacketAssetPatch[];
  relationPatches?: PacketRelationPatch[];
  outputSource?: PacketOutputSource;
  provenanceNotes?: string[];
}

export interface ChangeProposal {
  proposalId: string;
  sourcePacketId: string;
  stage: PacketStage;
  summary: string;
  qualityScore: number;
  priority: "critical" | "high" | "medium" | "low";
  category: "asset-change" | "relation-change" | "verification-remediation" | "artifact-update" | "mixed";
  assetPatches: PacketAssetPatch[];
  relationPatches: PacketRelationPatch[];
  issues: string[];
  suggestions: string[];
  changedDropIds: string[];
  acceptanceCoverageDropIds: string[];
  artifactContent?: string;
  gateStatus: "pass" | "warn" | "fail";
  gateReasons: string[];
  status: "proposed" | "applied" | "rejected";
  createdAt: string;
  appliedAt?: string;
  rejectedAt?: string;
}

export interface MainLoopAction {
  key: AssistantLoopActionKey;
  label: string;
  detail: string;
}

export interface ReviewCheckpoint {
  checkpointId: string;
  kind: "input" | "review" | "risk" | "acceptance";
  title: string;
  summary: string;
  source: "goal" | "automation" | "dry-run" | "verify";
  targetDropId?: string;
  approvalClass?: ApprovalClass;
  nextAction: MainLoopAction;
  evidence: string[];
  createdAt: string;
}

export interface MainLoopArtifactSummary {
  candidateId: string;
  excerpt: string;
  createdAt: string;
  coverageDropCount: number;
  accepted: boolean;
  acceptedAt?: string;
}

export interface MainLoopResultSummary {
  trust: AssistantLoopUserState;
  label: "ready" | "needs input" | "risk found" | "evidence attached";
  summary: string;
  evidenceCount: number;
  changedDropCount: number;
  createdAt?: string;
}

export interface AssistantLoopState {
  status: AssistantLoopStatus;
  userState: AssistantLoopUserState;
  statusLabel: string;
  summary: string;
  blockedReason?: string;
  nextAction: MainLoopAction;
  updatedAt: string;
  lastRunAt?: string;
  latestCandidateId?: string;
  latestVerifyPass?: boolean;
  lastError?: string;
}

export interface MainLoopSnapshot {
  status: AssistantLoopStatus;
  userState: AssistantLoopUserState;
  statusLabel: string;
  summary: string;
  blockedReason?: string;
  primaryAction: MainLoopAction;
  currentGoalSummary?: string;
  latestArtifact?: MainLoopArtifactSummary;
  latestResult?: MainLoopResultSummary;
  acceptanceStatus: "pending" | "accepted";
  acceptedCandidateId?: string;
  acceptedAt?: string;
  nextCheckpoint?: ReviewCheckpoint;
  reviewCheckpoints: ReviewCheckpoint[];
  openCheckpointCount: number;
  stageChain: ["asset", "proposal", "gate", "apply", "verify"];
  latestProposalId?: string;
  latestProposalStatus?: ChangeProposal["status"];
  latestProposalGate?: ChangeProposal["gateStatus"];
  appliedProposalId?: string;
  latestCandidateId?: string;
  latestVerifyPass?: boolean;
  lastRunAt?: string;
}

export interface PacketResponse {
  packetId: string;
  stage: PacketStage;
  provider: string;
  model: string;
  usedFallback: boolean;
  outputSource: PacketOutputSource;
  summary: string;
  outputText: string;
  artifactContent?: string;
  verifyIssues?: string[];
  verifySuggestions?: string[];
  structured?: PacketStructuredOutput;
  evidence: string[];
  createdAt: string;
}

export interface PacketRecord {
  packetId: string;
  stage: PacketStage;
  request: PacketRequest;
  response: PacketResponse;
  createdAt: string;
}

export interface SchemaValidationIssue {
  schemaId: string;
  instancePath: string;
  message: string;
}

export interface SchemaValidationReport {
  pass: boolean;
  schemaVersion: SchemaVersion;
  validatedSchemas: string[];
  issueCount: number;
  issues: SchemaValidationIssue[];
}

export interface GenerationDiff {
  baselineCandidateId?: string;
  addedDropIds: string[];
  changedDropIds: string[];
  removedDropIds: string[];
  addedRelationKeys: string[];
  removedRelationKeys: string[];
  changedWellFields: ChangedWellField[];
  relationDeltaCount: number;
  constraintChanged: boolean;
  acceptanceChanged: boolean;
}

export interface WellState {
  schemaVersion: SchemaVersion;
  project: ProjectState;
  well: Well;
  drops: Drop[];
  relations: Relation[];
  candidates: CandidateArtifact[];
  proposals: ChangeProposal[];
  verifyReports: VerifyReport[];
  verifyCycles: VerifyCycleRecord[];
  selfIterationRecords: SelfIterationRecord[];
  packetRecords: PacketRecord[];
  pendingChangedDropIds: string[];
  runLogs: RunLog[];
  unresolvedQuestions: string[];
  assetConversations: ConversationMessage[];
  automationTasks: AutomationTaskRecord[];
  assistantLoop: AssistantLoopState;
}

export interface CatalogAsset {
  dropId: string;
  type: AssetType;
  domain: AssetDomain;
  scope: AssetScope;
  owner: AssetOwner;
  layer: AssetLayer;
  priority: Priority;
  title: string;
  summary: string;
  purpose?: string;
  sourceFile: string;
  active: boolean;
}
