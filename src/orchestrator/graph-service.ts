import { randomUUID } from "node:crypto";
import type {
  AssetDomain,
  AssetOwner,
  AssetScope,
  ChangeProposal,
  Drop,
  MicroLifecycleSummary,
  PacketAssetPatch,
  PacketRelationPatch,
  Priority,
  Relation,
  RelationType,
  WellState,
} from "./types.js";
import { refreshAcceptanceTraceLinks } from "./acceptance-traceability.js";

function nowIso(): string {
  return new Date().toISOString();
}

function relationExists(relations: Relation[], patch: PacketRelationPatch): Relation | undefined {
  return relations.find((relation) =>
    relation.fromDropId === patch.fromDropId
    && relation.toDropId === patch.toDropId
    && relation.relationType === patch.relationType);
}

function hasDrop(state: WellState, dropId: string): boolean {
  return state.drops.some((drop) => drop.dropId === dropId);
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

function createGeneratedDrop(state: WellState, patch: PacketAssetPatch): Drop {
  const createdAt = nowIso();
  return {
    dropId: `drop-${randomUUID().slice(0, 8)}`,
    wellId: state.well.id,
    type: patch.type ?? "generated-gap",
    domain: patch.domain ?? "delivery",
    scope: patch.scope ?? "run-local",
    source: "ai-generated",
    owner: patch.owner ?? "delivery-core",
    layer: patch.layer ?? "contract",
    title: patch.title,
    summary: patch.summary,
    purpose: patch.purpose ?? "AI-generated change candidate.",
    content: patch.purpose ?? patch.summary,
    priority: patch.priority ?? "p2",
    confidence: 0.78,
    licenseState: "known",
    lifecycleState: "candidate",
    parentDropId: patch.parentDropId,
    createdAt,
    updatedAt: createdAt,
  };
}

export function autoAttachDrop(state: WellState, drop: Drop): void {
  const goalId = state.well.originDropId;
  if (!goalId) {
    return;
  }
  const hasRelation = state.relations.some(
    (rel) => rel.fromDropId === drop.dropId || rel.toDropId === drop.dropId,
  );
  if (hasRelation) {
    return;
  }
  const parent = drop.parentDropId ?? goalId;
  state.relations.push(createRelation(state.well.id, parent, drop.dropId, "implements"));
}

export function applyMicroLifecycle(state: WellState): MicroLifecycleSummary {
  const promoted: string[] = [];
  const archived: string[] = [];
  const untouched: string[] = [];

  for (const drop of state.drops) {
    if (drop.scope !== "run-local") {
      continue;
    }
    const hasRelations = state.relations.some(
      (rel) => rel.fromDropId === drop.dropId || rel.toDropId === drop.dropId,
    );
    const relationCount = state.relations.filter(
      (rel) => rel.fromDropId === drop.dropId || rel.toDropId === drop.dropId,
    ).length;
    const blocksCritical = hasRelations && drop.priority === "p0";
    const reusable = relationCount >= 2;
    const highRisk = drop.summary.toLowerCase().includes("risk");

    if (blocksCritical || reusable || highRisk) {
      if (drop.lifecycleState !== "promoted") {
        drop.lifecycleState = "promoted";
        drop.priority = drop.priority === "p2" ? "p1" : drop.priority;
        promoted.push(drop.dropId);
      } else {
        untouched.push(drop.dropId);
      }
      continue;
    }

    if (drop.lifecycleState === "candidate") {
      untouched.push(drop.dropId);
      continue;
    }

    if (drop.lifecycleState === "promoted" && !hasRelations) {
      drop.lifecycleState = "archived";
      drop.priority = "p2";
      archived.push(drop.dropId);
      continue;
    }

    untouched.push(drop.dropId);
  }

  return {
    promoted,
    archived,
    untouched,
    createdAt: nowIso(),
  };
}

export function applyProposalToState(input: {
  state: WellState;
  proposal: ChangeProposal;
  markChanged: (dropId?: string) => void;
  removeRelation: (relationId: string) => boolean;
}): {
  appliedAssetPatchCount: number;
  appliedRelationPatchCount: number;
  changedDropIds: string[];
} {
  const { state, proposal, markChanged, removeRelation } = input;
  let appliedAssetPatchCount = 0;
  let appliedRelationPatchCount = 0;
  const changedDropIds = new Set<string>();

  for (const patch of proposal.assetPatches ?? []) {
    if (patch.action === "archive" && patch.dropId) {
      const existing = state.drops.find((drop) => drop.dropId === patch.dropId);
      if (existing) {
        existing.lifecycleState = "archived";
        existing.updatedAt = nowIso();
        markChanged(existing.dropId);
        changedDropIds.add(existing.dropId);
        appliedAssetPatchCount += 1;
      }
      continue;
    }

    if (patch.action === "update" && patch.dropId) {
      const existing = state.drops.find((drop) => drop.dropId === patch.dropId);
      if (existing) {
        existing.title = patch.title || existing.title;
        existing.summary = patch.summary || existing.summary;
        existing.purpose = patch.purpose ?? existing.purpose;
        existing.parentDropId = patch.parentDropId ?? existing.parentDropId;
        existing.updatedAt = nowIso();
        refreshAcceptanceTraceLinks(existing, state);
        markChanged(existing.dropId);
        changedDropIds.add(existing.dropId);
        appliedAssetPatchCount += 1;
      }
      continue;
    }

    if (patch.action === "add") {
      const next = createGeneratedDrop(state, patch);
      state.drops.push(next);
      refreshAcceptanceTraceLinks(next, state);
      autoAttachDrop(state, next);
      markChanged(next.dropId);
      changedDropIds.add(next.dropId);
      appliedAssetPatchCount += 1;
    }
  }

  for (const patch of proposal.relationPatches ?? []) {
    const existing = relationExists(state.relations, patch);
    if (patch.action === "remove") {
      if (existing) {
        removeRelation(existing.relationId);
        appliedRelationPatchCount += 1;
      }
      continue;
    }

    if (!existing && hasDrop(state, patch.fromDropId) && hasDrop(state, patch.toDropId)) {
      state.relations.push(createRelation(state.well.id, patch.fromDropId, patch.toDropId, patch.relationType));
      markChanged(patch.fromDropId);
      markChanged(patch.toDropId);
      changedDropIds.add(patch.fromDropId);
      changedDropIds.add(patch.toDropId);
      appliedRelationPatchCount += 1;
    }
  }

  return {
    appliedAssetPatchCount,
    appliedRelationPatchCount,
    changedDropIds: [...changedDropIds],
  };
}

export function runHeuristicAnalyze(state: WellState, markChanged: (dropId?: string) => void): void {
  state.well.status = "analyze";
  for (const drop of state.drops) {
    if (drop.type === "goal-origin") {
      if (refreshAcceptanceTraceLinks(drop, state)) {
        markChanged(drop.dropId);
      }
      continue;
    }
    if ((drop.summary ?? "").trim().length < 24) {
      const enriched = `${drop.title}: ${drop.summary}. analyzed-for ${state.well.artifactType} convergence.`;
      drop.summary = enriched;
      drop.content = enriched;
      drop.confidence = Math.max(drop.confidence, 0.81);
      drop.updatedAt = nowIso();
      markChanged(drop.dropId);
    }
    if (refreshAcceptanceTraceLinks(drop, state)) {
      markChanged(drop.dropId);
    }
  }
}

export function runHeuristicOrganize(state: WellState): void {
  state.well.status = "organize";
  const goalId = state.well.originDropId;
  if (!goalId) {
    return;
  }
  for (const drop of state.drops) {
    if (drop.dropId === goalId) {
      continue;
    }
    const connected = state.relations.some(
      (rel) => rel.fromDropId === drop.dropId || rel.toDropId === drop.dropId,
    );
    if (!connected) {
      state.relations.push(createRelation(state.well.id, goalId, drop.dropId, "supports"));
    }
  }
}

export function runHeuristicGapCheck(state: WellState, markChanged: (dropId?: string) => void): { createdGapDropId?: string } {
  state.well.status = "gap-check";
  const hasRuntimePacket = state.drops.some((drop) =>
    drop.summary.toLowerCase().includes("runtime packet")
    || drop.summary.toLowerCase().includes("analyze")
    || drop.summary.toLowerCase().includes("verify"),
  );
  if (hasRuntimePacket) {
    return {};
  }

  const createdAt = nowIso();
  const goalId = state.well.originDropId;
  const next: Drop = {
    dropId: `drop-${randomUUID().slice(0, 8)}`,
    wellId: state.well.id,
    type: "generated-gap",
    domain: "delivery",
    scope: "run-local",
    source: "ai-generated",
    owner: "delivery-core",
    layer: "contract",
    title: "Gap Candidate",
    summary: "Missing runtime packet evidence for analyze/generate/verify flow.",
    purpose: "Fill critical missing capability before generation.",
    content: "Propose runtime packet adapters and evidence wiring.",
    priority: "p1",
    confidence: 0.82,
    licenseState: "known",
    lifecycleState: "candidate",
    parentDropId: goalId,
    createdAt,
    updatedAt: createdAt,
  };
  state.drops.push(next);
  refreshAcceptanceTraceLinks(next, state);
  markChanged(next.dropId);
  return { createdGapDropId: next.dropId };
}
