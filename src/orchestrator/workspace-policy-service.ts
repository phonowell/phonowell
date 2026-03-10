import type { Drop, WellState, WorkspacePolicy } from "./types.js";
import { INBOX_DOMAIN_ID, SYSTEM_DOMAIN_ID, ensureDomainMapState, recordActivity } from "./domain-map-service.js";

export const WORKSPACE_POLICY_CLUSTER_ID = "cluster-workspace-policies";
export const WORKSPACE_POLICY_CLUSTER_LABEL = "Workspace Policies";

const TEXTUAL_POLICY_TYPES = new Set<Drop["type"]>(["note", "doc", "url", "generated"]);
const UNIVERSAL_SCOPE_PATTERN = /\b(all|every|each|entire|global|workspace|system-wide)\b|所有|全部|全局|统一|整个|每个|任何/u;
const DIRECTIVE_PATTERN = /\b(should|must|need(?:s)? to|shall|keep|ensure|require(?:d)?|always)\b|应该|必须|需要|保持|确保|不得/u;
const VISUAL_SCOPE_PATTERN = /\b(image|images|visual|visuals|picture|pictures|art|sprite)\b|图片|图像|画面|美术/u;
const TEXT_SCOPE_PATTERN = /\b(text|copy|language|wording|title|titles|summary|summaries|document|documents|note|notes|asset|assets)\b|文本|文案|语言|标题|摘要|文档|笔记|资产/u;

function normalizedText(drop: Drop): string {
  return [drop.title, drop.summary, drop.content]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .trim();
}

function trimInstruction(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 300);
}

function inferScopeHint(text: string): WorkspacePolicy["scopeHint"] {
  if (VISUAL_SCOPE_PATTERN.test(text)) {
    return "visual";
  }
  if (TEXT_SCOPE_PATTERN.test(text)) {
    return "text";
  }
  if (UNIVERSAL_SCOPE_PATTERN.test(text)) {
    return "assets";
  }
  return "workspace";
}

function heuristicPolicySignals(drop: Drop, text: string): { score: number; rationale: string[] } {
  const rationale: string[] = [];
  let score = 0;

  if (TEXTUAL_POLICY_TYPES.has(drop.type)) {
    score += 1;
    rationale.push("textual-asset");
  }
  if (drop.layer === "policy") {
    score += 4;
    rationale.push("already-marked-policy");
  }
  if (drop.scope === "well-global") {
    score += 1;
    rationale.push("well-global");
  }
  if (drop.source === "user") {
    score += 1;
    rationale.push("user-authored");
  }
  if (text.length >= 8 && text.length <= 320) {
    score += 1;
    rationale.push("compact-instruction-shape");
  }
  if (!/[?？]$/.test(text)) {
    score += 1;
    rationale.push("non-question");
  }
  if (UNIVERSAL_SCOPE_PATTERN.test(text)) {
    score += 2;
    rationale.push("universal-scope");
  }
  if (DIRECTIVE_PATTERN.test(text)) {
    score += 2;
    rationale.push("directive-language");
  }
  return { score, rationale };
}

export function detectWorkspacePolicy(drop: Drop): WorkspacePolicy | undefined {
  if (drop.lifecycleState === "archived") {
    return undefined;
  }
  if (drop.source === "docs") {
    return undefined;
  }
  const text = normalizedText(drop);
  if (!text) {
    return undefined;
  }

  const hasUniversalScope = UNIVERSAL_SCOPE_PATTERN.test(text);
  const hasDirectiveLanguage = DIRECTIVE_PATTERN.test(text);
  const { score, rationale } = heuristicPolicySignals(drop, text);
  if (score < 5 || (!hasUniversalScope && !hasDirectiveLanguage && drop.layer !== "policy")) {
    return undefined;
  }

  return {
    policyId: drop.dropId,
    sourceDropId: drop.dropId,
    title: drop.title,
    summary: drop.summary,
    instruction: trimInstruction(text),
    scopeHint: inferScopeHint(text),
    confidence: Math.min(0.99, 0.42 + (score * 0.08)),
    detectionMode: drop.layer === "policy" ? "declared" : "heuristic",
    rationale,
    activatedAt: drop.updatedAt,
  };
}

export function listWorkspacePolicies(state: WellState): WorkspacePolicy[] {
  return state.drops
    .map((drop) => detectWorkspacePolicy(drop))
    .filter((policy): policy is WorkspacePolicy => Boolean(policy))
    .sort((left, right) => right.confidence - left.confidence);
}

export function isWorkspacePolicyDrop(drop: Drop, policies: WorkspacePolicy[]): boolean {
  return policies.some((policy) => policy.sourceDropId === drop.dropId);
}

export function listWorkspacePolicyTargets(state: WellState, policies = listWorkspacePolicies(state)): Drop[] {
  const policyIds = new Set(policies.map((policy) => policy.sourceDropId));
  return state.drops.filter((drop) =>
    drop.lifecycleState !== "archived"
    && !policyIds.has(drop.dropId)
    && drop.source !== "docs"
    && (drop.domainId ?? INBOX_DOMAIN_ID) !== INBOX_DOMAIN_ID,
  );
}

export function stabilizeWorkspacePolicies(
  state: WellState,
  trigger: string,
): { activatedPolicies: WorkspacePolicy[]; activatedDropIds: string[] } {
  ensureDomainMapState(state);
  const policies = listWorkspacePolicies(state);
  const activatedDropIds: string[] = [];

  for (const policy of policies) {
    const drop = state.drops.find((item) => item.dropId === policy.sourceDropId);
    if (!drop) {
      continue;
    }

    const changed = drop.domainId !== SYSTEM_DOMAIN_ID
      || drop.clusterId !== WORKSPACE_POLICY_CLUSTER_ID
      || drop.clusterLabel !== WORKSPACE_POLICY_CLUSTER_LABEL
      || drop.layer !== "policy"
      || drop.scope !== "well-global";

    drop.domainId = SYSTEM_DOMAIN_ID;
    drop.clusterId = WORKSPACE_POLICY_CLUSTER_ID;
    drop.clusterLabel = WORKSPACE_POLICY_CLUSTER_LABEL;
    drop.layer = "policy";
    drop.scope = "well-global";

    if (!changed) {
      continue;
    }

    drop.updatedAt = new Date().toISOString();
    activatedDropIds.push(drop.dropId);
    recordActivity(state, {
      actor: "ai",
      kind: "policy-detected",
      summary: `Activated workspace policy: ${drop.title}`,
      detail: `trigger=${trigger}; scope=${policy.scopeHint}; confidence=${policy.confidence.toFixed(2)}; rationale=${policy.rationale.join(", ")}`,
      relatedDomainIds: [SYSTEM_DOMAIN_ID],
      relatedDropIds: [drop.dropId],
    });
  }

  return {
    activatedPolicies: policies,
    activatedDropIds,
  };
}
