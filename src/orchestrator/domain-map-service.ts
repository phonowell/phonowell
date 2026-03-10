import { randomUUID } from "node:crypto";
import type {
  ActivityTimelineEvent,
  DomainEdge,
  DomainEdgeKind,
  DomainNode,
  DomainNodeKind,
  DomainNodeStatus,
  Drop,
  GenerationRunRecord,
  Relation,
  RequirementDiffEntry,
  RequirementDiffSnapshot,
  RequirementSnapshot,
  WellState,
} from "./types.js";

export const INBOX_DOMAIN_ID = "domain-inbox";
export const SYSTEM_DOMAIN_ID = "domain-system";

type DomainBlueprint = {
  key: string;
  name: string;
  summary: string;
  match: RegExp;
};

const DOMAIN_BLUEPRINTS: DomainBlueprint[] = [
  {
    key: "combat",
    name: "Combat Systems",
    summary: "Combat rules, abilities, enemies, balance, and encounter logic.",
    match: /\b(combat|battle|skill|ability|weapon|enemy|boss|damage|attack|hit|hp|stat)\b/i,
  },
  {
    key: "narrative",
    name: "Narrative And Quests",
    summary: "Story arcs, quests, lore, dialogue, and world-building content.",
    match: /\b(story|narrative|quest|dialog|dialogue|lore|character|world|plot|mission)\b/i,
  },
  {
    key: "visual",
    name: "Visual Direction",
    summary: "Concept art, scene reference, style frames, and image-heavy visual material.",
    match: /\b(concept|scene|visual|image|art|sprite|environment|illustration|moodboard|reference)\b/i,
  },
  {
    key: "ui",
    name: "UI And Flow",
    summary: "HUD, menus, flows, onboarding, and interface interaction design.",
    match: /\b(ui|ux|hud|menu|screen|flow|wireframe|layout|interaction|onboarding)\b/i,
  },
  {
    key: "audio",
    name: "Audio Direction",
    summary: "Music, SFX, voice, ambience, and sound direction assets.",
    match: /\b(audio|music|sfx|sound|voice|ambience|ost)\b/i,
  },
  {
    key: "economy",
    name: "Progression And Economy",
    summary: "Currencies, reward loops, upgrade systems, and progression design.",
    match: /\b(progress|economy|reward|currency|shop|upgrade|level|growth|meta)\b/i,
  },
  {
    key: "technical",
    name: "Technical Delivery",
    summary: "Runtime, engine, tools, pipelines, and implementation-facing technical assets.",
    match: /\b(runtime|engine|tool|pipeline|build|tech|technical|performance|render|system)\b/i,
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function slug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function domainStatus(kind: DomainNodeKind, frozen: boolean, assetCount: number): DomainNodeStatus {
  if (frozen) {
    return "frozen";
  }
  if (kind === "inbox") {
    return assetCount > 0 ? "attention" : "stable";
  }
  if (assetCount === 0) {
    return "new";
  }
  return "stable";
}

function makeDomainNode(input: {
  wellId: string;
  domainId: string;
  name: string;
  summary: string;
  kind: DomainNodeKind;
  position: { x: number; y: number };
  createdAt?: string;
}): DomainNode {
  const createdAt = input.createdAt ?? nowIso();
  return {
    domainId: input.domainId,
    wellId: input.wellId,
    name: input.name,
    summary: input.summary,
    kind: input.kind,
    status: domainStatus(input.kind, false, 0),
    frozen: false,
    assetDropIds: [],
    position: input.position,
    createdAt,
    updatedAt: createdAt,
  };
}

function makeDomainEdge(input: {
  wellId: string;
  fromDomainId: string;
  toDomainId: string;
  kind: DomainEdgeKind;
  summary: string;
  createdAt?: string;
}): DomainEdge {
  const createdAt = input.createdAt ?? nowIso();
  return {
    edgeId: `domain-edge-${randomUUID().slice(0, 8)}`,
    wellId: input.wellId,
    fromDomainId: input.fromDomainId,
    toDomainId: input.toDomainId,
    kind: input.kind,
    summary: input.summary,
    createdAt,
    updatedAt: createdAt,
  };
}

function isSystemDrop(drop: Drop): boolean {
  return drop.scope === "well-global"
    || drop.source === "docs"
    || drop.type === "goal-origin";
}

function inferClusterLabel(drop: Drop): string {
  if (drop.layer === "policy") {
    return "Workspace Policies";
  }
  if (drop.type === "image") {
    return "Images";
  }
  if (drop.type === "doc" || drop.type === "url") {
    return "References";
  }
  const normalized = `${drop.title} ${drop.summary}`.toLowerCase();
  if (/\b(ui|ux|screen|menu|hud)\b/.test(normalized)) {
    return "Interface";
  }
  if (/\b(quest|story|dialog|lore)\b/.test(normalized)) {
    return "Narrative";
  }
  if (/\b(combat|battle|skill|enemy|weapon)\b/.test(normalized)) {
    return "Gameplay";
  }
  if (/\b(audio|music|sound|voice)\b/.test(normalized)) {
    return "Audio";
  }
  return "General";
}

function inferDomainBlueprint(drop: Drop): DomainBlueprint {
  const normalized = `${drop.title} ${drop.summary}`.toLowerCase();
  return DOMAIN_BLUEPRINTS.find((item) => item.match.test(normalized)) ?? {
    key: "general",
    name: "General Workspace",
    summary: "Mixed working material that still needs stronger structure.",
    match: /.*/i,
  };
}

export function recordActivity(
  state: WellState,
  input: Omit<ActivityTimelineEvent, "activityId" | "createdAt"> & { createdAt?: string },
): ActivityTimelineEvent {
  const createdAt = input.createdAt ?? nowIso();
  const event: ActivityTimelineEvent = {
    activityId: `activity-${randomUUID().slice(0, 8)}`,
    createdAt,
    ...input,
  };
  state.activityTimeline.unshift(event);
  state.activityTimeline = state.activityTimeline.slice(0, 120);
  return event;
}

export const pushActivity = recordActivity;

export function ensureDomainMapState(state: WellState): void {
  state.domainNodes = Array.isArray(state.domainNodes) ? state.domainNodes : [];
  state.domainEdges = Array.isArray(state.domainEdges) ? state.domainEdges : [];
  state.activityTimeline = Array.isArray(state.activityTimeline) ? state.activityTimeline : [];
  state.generationHistory = Array.isArray(state.generationHistory) ? state.generationHistory : [];

  if (!state.domainNodes.some((item) => item.domainId === SYSTEM_DOMAIN_ID)) {
    state.domainNodes.push(makeDomainNode({
      wellId: state.well.id,
      domainId: SYSTEM_DOMAIN_ID,
      name: "System Domain",
      summary: "System-owned assets, canonical references, and global control nodes.",
      kind: "system",
      position: { x: -420, y: -260 },
    }));
  }

  if (!state.domainNodes.some((item) => item.domainId === INBOX_DOMAIN_ID)) {
    state.domainNodes.push(makeDomainNode({
      wellId: state.well.id,
      domainId: INBOX_DOMAIN_ID,
      name: "Inbox",
      summary: "Unsorted assets waiting for AI assignment.",
      kind: "inbox",
      position: { x: 520, y: 320 },
    }));
  }

  const domainIdSet = new Set(state.domainNodes.map((item) => item.domainId));
  for (const drop of state.drops) {
    if (!drop.domainId || !domainIdSet.has(drop.domainId)) {
      drop.domainId = isSystemDrop(drop) ? SYSTEM_DOMAIN_ID : INBOX_DOMAIN_ID;
    }
    if (!drop.clusterLabel && drop.domainId !== INBOX_DOMAIN_ID) {
      drop.clusterLabel = inferClusterLabel(drop);
      drop.clusterId = `cluster-${slug(drop.clusterLabel)}`;
    }
  }

  rebuildDomainMembership(state);
  rebuildDomainEdges(state);
}

export const ensureDomainStructures = ensureDomainMapState;

export function rebuildDomainMembership(state: WellState): void {
  const dropsByDomain = new Map<string, string[]>();
  for (const domain of state.domainNodes) {
    dropsByDomain.set(domain.domainId, []);
  }
  for (const drop of state.drops) {
    const domainId = drop.domainId ?? INBOX_DOMAIN_ID;
    if (!dropsByDomain.has(domainId)) {
      dropsByDomain.set(domainId, []);
    }
    dropsByDomain.get(domainId)!.push(drop.dropId);
  }
  for (const domain of state.domainNodes) {
    const assetDropIds = dropsByDomain.get(domain.domainId) ?? [];
    domain.assetDropIds = assetDropIds;
    domain.status = domainStatus(domain.kind, domain.frozen, assetDropIds.length);
    domain.updatedAt = nowIso();
  }
}

export function findDomainById(state: WellState, domainId: string): DomainNode | undefined {
  return state.domainNodes.find((item) => item.domainId === domainId);
}

export function findOrCreateDomainForBlueprint(state: WellState, blueprint: DomainBlueprint): DomainNode {
  const existing = state.domainNodes.find((item) =>
    slug(item.name) === slug(blueprint.name)
    && item.kind === "workspace"
    && !item.frozen,
  );
  if (existing) {
    return existing;
  }
  const index = state.domainNodes.filter((item) => item.kind === "workspace").length;
  const exactNameTaken = state.domainNodes.some((item) => slug(item.name) === slug(blueprint.name));
  const resolvedName = exactNameTaken ? `${blueprint.name} ${index + 1}` : blueprint.name;
  const node = makeDomainNode({
    wellId: state.well.id,
    domainId: `domain-${blueprint.key}-${randomUUID().slice(0, 6)}`,
    name: resolvedName,
    summary: blueprint.summary,
    kind: "workspace",
    position: {
      x: -80 + (index % 3) * 320,
      y: -40 + Math.floor(index / 3) * 240,
    },
  });
  state.domainNodes.push(node);
  recordActivity(state, {
    actor: "ai",
    kind: "domain-created",
    summary: `Created domain: ${node.name}`,
    detail: blueprint.summary,
    relatedDomainIds: [node.domainId],
    relatedDropIds: [],
  });
  return node;
}

export function updateDomainNode(
  state: WellState,
  domainId: string,
  input: { name?: string; summary?: string; frozen?: boolean; actor?: "ai" | "user" | "system" },
): DomainNode {
  ensureDomainMapState(state);
  const domain = state.domainNodes.find((item) => item.domainId === domainId);
  if (!domain) {
    throw new Error(`domain not found: ${domainId}`);
  }
  if (domain.kind !== "workspace") {
    throw new Error("only workspace domains can be edited");
  }

  const before = {
    name: domain.name,
    summary: domain.summary,
    frozen: domain.frozen,
  };

  if (typeof input.name === "string" && input.name.trim()) {
    domain.name = input.name.trim();
  }
  if (typeof input.summary === "string") {
    domain.summary = input.summary.trim() || domain.summary;
  }
  if (typeof input.frozen === "boolean") {
    domain.frozen = input.frozen;
  }

  domain.updatedAt = nowIso();
  domain.lastActivityAt = domain.updatedAt;
  rebuildDomainMembership(state);

  const changes = [
    before.name !== domain.name ? `name: ${before.name} -> ${domain.name}` : null,
    before.summary !== domain.summary ? "summary updated" : null,
    before.frozen !== domain.frozen ? `frozen=${String(domain.frozen)}` : null,
  ].filter(Boolean).join("; ");

  recordActivity(state, {
    actor: input.actor ?? "user",
    kind: "domain-updated",
    summary: `Updated domain: ${domain.name}`,
    detail: changes || "manual domain edit",
    relatedDomainIds: [domain.domainId],
    relatedDropIds: [...domain.assetDropIds],
  });

  return domain;
}

export function assignDropToDomain(
  state: WellState,
  input: {
    dropId: string;
    domainId: string;
    actor: "ai" | "user" | "system";
    detail?: string;
    trackActivity?: boolean;
  },
): Drop | undefined {
  const drop = state.drops.find((item) => item.dropId === input.dropId);
  if (!drop) {
    return undefined;
  }
  const previousDomainId = drop.domainId ?? INBOX_DOMAIN_ID;
  drop.domainId = input.domainId;
  drop.clusterLabel = input.domainId === INBOX_DOMAIN_ID ? undefined : inferClusterLabel(drop);
  drop.clusterId = drop.clusterLabel ? `cluster-${slug(drop.clusterLabel)}` : undefined;
  drop.updatedAt = nowIso();
  rebuildDomainMembership(state);
  rebuildDomainEdges(state);
  if (input.trackActivity !== false && previousDomainId !== input.domainId) {
    recordActivity(state, {
      actor: input.actor,
      kind: input.actor === "user" ? "correction" : "domain-updated",
      summary: `Moved asset: ${drop.title}`,
      detail: input.detail ?? `${previousDomainId} -> ${input.domainId}`,
      relatedDomainIds: [previousDomainId, input.domainId],
      relatedDropIds: [drop.dropId],
    });
  }
  return drop;
}

export function organizeInboxDomains(
  state: WellState,
  trigger: string,
): { assignedDropIds: string[]; createdDomainIds: string[] } {
  ensureDomainMapState(state);
  const inboxDrops = state.drops.filter((drop) =>
    drop.lifecycleState !== "archived"
    && !isSystemDrop(drop)
    && (drop.domainId ?? INBOX_DOMAIN_ID) === INBOX_DOMAIN_ID,
  );

  const assignedDropIds: string[] = [];
  const createdDomainIds = new Set<string>();

  for (const drop of inboxDrops) {
    const blueprint = inferDomainBlueprint(drop);
    const existed = state.domainNodes.some((item) => slug(item.name) === slug(blueprint.name));
    const domain = findOrCreateDomainForBlueprint(state, blueprint);
    if (!existed) {
      createdDomainIds.add(domain.domainId);
    }
    assignDropToDomain(state, {
      dropId: drop.dropId,
      domainId: domain.domainId,
      actor: "ai",
      detail: `organized:${trigger}`,
    });
    assignedDropIds.push(drop.dropId);
  }

  rebuildDomainMembership(state);
  rebuildDomainEdges(state);
  recordActivity(state, {
    actor: "ai",
    kind: "organize",
    summary: `Organized inbox assets (${assignedDropIds.length})`,
    detail: trigger,
    relatedDomainIds: [...createdDomainIds],
    relatedDropIds: assignedDropIds,
  });
  return { assignedDropIds, createdDomainIds: [...createdDomainIds] };
}

export function rebuildDomainEdges(state: WellState): void {
  const dropById = new Map(state.drops.map((drop) => [drop.dropId, drop]));
  const edgeMap = new Map<string, { fromDomainId: string; toDomainId: string; kind: DomainEdgeKind; count: number }>();

  for (const relation of state.relations) {
    const fromDrop = dropById.get(relation.fromDropId);
    const toDrop = dropById.get(relation.toDropId);
    if (!fromDrop || !toDrop) {
      continue;
    }
    const fromDomainId = fromDrop.domainId ?? INBOX_DOMAIN_ID;
    const toDomainId = toDrop.domainId ?? INBOX_DOMAIN_ID;
    if (fromDomainId === toDomainId || fromDomainId === INBOX_DOMAIN_ID || toDomainId === INBOX_DOMAIN_ID) {
      continue;
    }
    const kind: DomainEdgeKind =
      relation.relationType === "constrains" ? "structure"
        : relation.relationType === "derives" ? "causal"
          : "supports";
    const key = `${fromDomainId}|${toDomainId}|${kind}`;
    const existing = edgeMap.get(key);
    edgeMap.set(key, {
      fromDomainId,
      toDomainId,
      kind,
      count: (existing?.count ?? 0) + 1,
    });
  }

  state.domainEdges = [...edgeMap.values()].map((item) =>
    makeDomainEdge({
      wellId: state.well.id,
      fromDomainId: item.fromDomainId,
      toDomainId: item.toDomainId,
      kind: item.kind,
      summary: `${item.count} structural signals`,
    }));
}

export function listInboxDrops(state: WellState): Drop[] {
  ensureDomainMapState(state);
  return state.drops.filter((drop) => (drop.domainId ?? INBOX_DOMAIN_ID) === INBOX_DOMAIN_ID);
}

export function summarizeDomainRelations(state: WellState, domainId: string): Relation[] {
  const dropIds = new Set(state.drops.filter((drop) => drop.domainId === domainId).map((drop) => drop.dropId));
  return state.relations.filter((relation) => dropIds.has(relation.fromDropId) && dropIds.has(relation.toDropId));
}

function flattenRequirementSnapshot(snapshot: RequirementSnapshot): Map<string, string> {
  const next = new Map<string, string>();
  next.set("wish", snapshot.wish);
  if (snapshot.goalSummary) {
    next.set("goal-summary", snapshot.goalSummary);
  }
  snapshot.definitionOfDone.forEach((item, index) => next.set(`dod:${index}`, item));
  snapshot.constraints.forEach((item, index) => next.set(`constraint:${index}`, item));
  snapshot.domainSignatures.forEach((item) => next.set(`domain:${item.split("::")[0]}`, item));
  snapshot.inboxDropIds.forEach((item, index) => next.set(`inbox:${index}`, item));
  return next;
}

function summarizeRequirementDiff(entries: RequirementDiffEntry[]): string {
  if (entries.length === 0) {
    return "No requirement change since the last generation.";
  }
  const added = entries.filter((item) => item.status === "added").length;
  const removed = entries.filter((item) => item.status === "removed").length;
  const changed = entries.filter((item) => item.status === "changed").length;
  return `Requirement change detected: ${added} added, ${changed} changed, ${removed} removed.`;
}

export function buildRequirementSnapshot(state: WellState): RequirementSnapshot {
  ensureDomainMapState(state);
  const goal = state.drops.find((drop) => drop.type === "goal-origin");
  return {
    snapshotId: `snapshot-${randomUUID().slice(0, 8)}`,
    wish: state.well.wish,
    goalSummary: goal?.summary,
    definitionOfDone: [...state.well.definitionOfDone],
    constraints: [...state.well.constraints],
    domainSignatures: state.domainNodes
      .filter((node) => node.kind === "workspace" && node.assetDropIds.length > 0)
      .map((node) => `${node.name}::${node.summary}::${node.assetDropIds.length}`)
      .sort(),
    inboxDropIds: listInboxDrops(state).map((drop) => drop.dropId),
    createdAt: nowIso(),
  };
}

export function buildRequirementDiff(
  baseline: RequirementSnapshot | undefined,
  current: RequirementSnapshot,
): RequirementDiffSnapshot {
  if (!baseline) {
    return {
      baselineSnapshotId: undefined,
      entries: current.domainSignatures.map((item) => ({
        key: `domain:${item.split("::")[0]}`,
        status: "added",
        after: item,
      })),
      summary: "Initial generation snapshot captured.",
      createdAt: nowIso(),
    };
  }

  const before = flattenRequirementSnapshot(baseline);
  const after = flattenRequirementSnapshot(current);
  const entries: RequirementDiffEntry[] = [];
  const keys = new Set([...before.keys(), ...after.keys()]);
  for (const key of keys) {
    const beforeValue = before.get(key);
    const afterValue = after.get(key);
    if (beforeValue === undefined && afterValue !== undefined) {
      entries.push({ key, status: "added", after: afterValue });
      continue;
    }
    if (beforeValue !== undefined && afterValue === undefined) {
      entries.push({ key, status: "removed", before: beforeValue });
      continue;
    }
    if (beforeValue !== afterValue) {
      entries.push({ key, status: "changed", before: beforeValue, after: afterValue });
    }
  }

  return {
    baselineSnapshotId: baseline.snapshotId,
    entries,
    summary: summarizeRequirementDiff(entries),
    createdAt: nowIso(),
  };
}

export function recordGenerationRun(
  state: WellState,
  input: { candidateId?: string; snapshot: RequirementSnapshot; diff: RequirementDiffSnapshot },
): GenerationRunRecord {
  const record: GenerationRunRecord = {
    recordId: `generation-run-${randomUUID().slice(0, 8)}`,
    candidateId: input.candidateId,
    snapshot: input.snapshot,
    diff: input.diff,
    createdAt: nowIso(),
  };
  state.generationHistory.unshift(record);
  state.generationHistory = state.generationHistory.slice(0, 30);
  return record;
}
