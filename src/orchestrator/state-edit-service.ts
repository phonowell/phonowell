import { randomUUID } from "node:crypto";
import type {
  AcceptanceTraceLink,
  AssetDomain,
  AssetOwner,
  AssetScope,
  AssetSource,
  AssetType,
  Drop,
  Priority,
  Relation,
  RelationType,
  Well,
  WellState,
} from "./types.js";
import { autoAttachDrop, applyMicroLifecycle } from "./graph-service.js";
import { refreshAcceptanceTraceLinks } from "./acceptance-traceability.js";

function nowIso(): string {
  return new Date().toISOString();
}

function createRelation(wellId: string, fromDropId: string, toDropId: string, relationType: RelationType, createdAt = nowIso()): Relation {
  return {
    relationId: `rel-${randomUUID().slice(0, 8)}`,
    wellId,
    fromDropId,
    toDropId,
    relationType,
    createdAt,
  };
}

export function updateWish(state: WellState, input: { wish: string; definitionOfDone: string[]; constraints: string[] }): Well {
  state.well.wish = input.wish.trim();
  state.well.definitionOfDone = input.definitionOfDone;
  state.well.constraints = input.constraints;
  state.well.updatedAt = nowIso();
  state.well.status = "chat-intake";
  return structuredClone(state.well);
}

export function ensureGoalOriginDraft(state: WellState): Drop {
  const existing = state.drops.find((drop) => drop.type === "goal-origin");
  if (existing) {
    return structuredClone(existing);
  }
  const createdAt = nowIso();
  const goal: Drop = {
    dropId: `drop-goal-origin-${randomUUID().slice(0, 8)}`,
    wellId: state.well.id,
    type: "goal-origin",
    domain: "core",
    scope: "well-global",
    source: "ai-generated",
    owner: "product-core",
    layer: "contract",
    title: "Goal Origin",
    summary: state.well.wish,
    purpose: "Project anchor for one-well-one-artifact convergence.",
    content: state.well.wish,
    priority: "p0",
    confidence: 0.88,
    licenseState: "known",
    goalStatus: "draft",
    createdAt,
    updatedAt: createdAt,
    position: { x: 0, y: 0 },
  };
  state.drops.unshift(goal);
  state.well.originDropId = goal.dropId;
  state.relations.push(createRelation(state.well.id, goal.dropId, "drop-canon-v1-delivery", "constrains", createdAt));
  state.well.status = "goal-origin-init";
  state.well.updatedAt = createdAt;
  return structuredClone(goal);
}

export function updateGoalOrigin(state: WellState, input: { title?: string; summary?: string; status?: "draft" | "confirmed" | "revised" }): Drop {
  const goal = state.drops.find((drop) => drop.type === "goal-origin");
  if (!goal) {
    throw new Error("goal-origin not initialized");
  }
  if (input.title) {
    goal.title = input.title;
  }
  if (input.summary) {
    goal.summary = input.summary;
    goal.content = input.summary;
    state.well.wish = input.summary;
  }
  if (input.status) {
    goal.goalStatus = input.status;
    if (input.status === "confirmed") {
      state.well.status = "first-principles-modeling";
    }
  }
  goal.updatedAt = nowIso();
  state.well.updatedAt = goal.updatedAt;
  return structuredClone(goal);
}

export function ingestDrop(state: WellState, input: {
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
  preserveOrphan?: boolean;
}): Drop {
  const createdAt = nowIso();
  const drop: Drop = {
    dropId: `drop-${randomUUID().slice(0, 8)}`,
    wellId: state.well.id,
    type: input.type,
    domain: input.domain ?? "delivery",
    scope: input.scope ?? "run-local",
    source: input.source,
    owner: input.owner ?? (input.source === "user" ? "user" : "delivery-core"),
    layer: input.layer ?? (input.type.startsWith("reference-") ? "reference" : "contract"),
    title: input.title,
    summary: input.summary,
    purpose: "User-provided or AI-derived supporting asset.",
    content: input.content ?? input.summary,
    priority: input.priority ?? "p2",
    confidence: 0.75,
    licenseState: "unknown",
    lifecycleState: "candidate",
    parentDropId: input.parentDropId,
    acceptanceTraceLinks: [],
    createdAt,
    updatedAt: createdAt,
    position: {
      x: Number.isFinite(input.x) ? Number(input.x) : Math.floor(Math.random() * 500 - 250),
      y: Number.isFinite(input.y) ? Number(input.y) : Math.floor(Math.random() * 500 - 250),
    },
  };
  state.drops.push(drop);
  refreshAcceptanceTraceLinks(drop, state);
  if (!input.preserveOrphan) {
    autoAttachDrop(state, drop);
    applyMicroLifecycle(state);
  }
  state.well.status = "ingest";
  state.well.updatedAt = createdAt;
  return structuredClone(drop);
}

export function updateDrop(state: WellState, dropId: string, input: Partial<Pick<Drop, "summary" | "title" | "position">>): Drop {
  const drop = state.drops.find((item) => item.dropId === dropId);
  if (!drop) {
    throw new Error(`drop not found: ${dropId}`);
  }
  if (typeof input.title === "string" && input.title.trim()) {
    drop.title = input.title.trim();
  }
  if (typeof input.summary === "string") {
    drop.summary = input.summary;
    drop.content = input.summary;
  }
  if (typeof input.summary === "string" || typeof input.title === "string") {
    refreshAcceptanceTraceLinks(drop, state);
  }
  if (input.position && Number.isFinite(input.position.x) && Number.isFinite(input.position.y)) {
    drop.position = { x: Number(input.position.x), y: Number(input.position.y) };
  }
  drop.updatedAt = nowIso();
  state.well.status = input.position ? "organize" : "analyze";
  state.well.updatedAt = drop.updatedAt;
  return structuredClone(drop);
}

export function setAcceptanceTraceLinks(
  state: WellState,
  dropId: string,
  links: AcceptanceTraceLink[],
): Drop {
  const drop = state.drops.find((item) => item.dropId === dropId);
  if (!drop) {
    throw new Error(`drop not found: ${dropId}`);
  }
  drop.acceptanceTraceLinks = links;
  drop.updatedAt = nowIso();
  return structuredClone(drop);
}

export function connectDrops(state: WellState, fromDropId: string, toDropId: string, relationType: RelationType = "references"): Relation {
  if (fromDropId === toDropId) {
    throw new Error("cannot connect a drop to itself");
  }
  const fromExists = state.drops.some((drop) => drop.dropId === fromDropId);
  const toExists = state.drops.some((drop) => drop.dropId === toDropId);
  if (!fromExists || !toExists) {
    throw new Error("relation endpoints must reference existing drops");
  }
  const existing = state.relations.find((rel) =>
    rel.fromDropId === fromDropId
    && rel.toDropId === toDropId
    && rel.relationType === relationType);
  if (existing) {
    throw new Error("relation already exists");
  }
  const now = nowIso();
  const relation = createRelation(state.well.id, fromDropId, toDropId, relationType, now);
  state.relations.push(relation);
  applyMicroLifecycle(state);
  state.well.status = "organize";
  state.well.updatedAt = now;
  return structuredClone(relation);
}

export function removeRelation(state: WellState, relationId: string): boolean {
  const prevLen = state.relations.length;
  state.relations = state.relations.filter((rel) => rel.relationId !== relationId);
  if (state.relations.length < prevLen) {
    state.well.status = "organize";
    state.well.updatedAt = nowIso();
    return true;
  }
  return false;
}

export function updateUnresolvedQuestions(state: WellState, questions: string[]): string[] {
  state.unresolvedQuestions = questions.filter((q) => q.trim().length > 0);
  state.well.updatedAt = nowIso();
  return [...state.unresolvedQuestions];
}
