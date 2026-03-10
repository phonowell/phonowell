import { randomUUID } from "node:crypto";
import type {
  GenerationRunRecord,
  RequirementDiffEntry,
  RequirementDiffSnapshot,
  RequirementSnapshot,
  WellState,
} from "./types.js";
import { INBOX_DOMAIN_ID } from "./domain-map-service.js";

function nowIso(): string {
  return new Date().toISOString();
}

function goalSummary(state: WellState): string | undefined {
  return state.drops.find((drop) => drop.type === "goal-origin")?.summary;
}

export function buildRequirementSnapshot(state: WellState): RequirementSnapshot {
  const createdAt = nowIso();
  const domainSignatures = state.domainNodes
    .filter((item) => item.domainId !== INBOX_DOMAIN_ID)
    .map((item) => `${item.name} :: ${item.summary} :: assets=${item.assetDropIds.length}`)
    .sort();
  const inboxDropIds = state.drops
    .filter((drop) => (drop.domainId ?? INBOX_DOMAIN_ID) === INBOX_DOMAIN_ID)
    .map((drop) => `${drop.dropId}:${drop.title}`)
    .sort();

  return {
    snapshotId: `req-${randomUUID().slice(0, 8)}`,
    wish: state.well.wish,
    goalSummary: goalSummary(state),
    definitionOfDone: [...state.well.definitionOfDone],
    constraints: [...state.well.constraints],
    domainSignatures,
    inboxDropIds,
    createdAt,
  };
}

export function diffRequirementSnapshots(
  baseline: RequirementSnapshot | undefined,
  current: RequirementSnapshot,
): RequirementDiffSnapshot {
  const entries: RequirementDiffEntry[] = [];
  const createdAt = nowIso();

  if (!baseline) {
    entries.push({
      key: "wish",
      status: "added",
      after: current.wish,
    });
    for (const item of current.definitionOfDone) {
      entries.push({ key: `dod:${item}`, status: "added", after: item });
    }
    for (const item of current.constraints) {
      entries.push({ key: `constraint:${item}`, status: "added", after: item });
    }
    for (const item of current.domainSignatures) {
      entries.push({ key: `domain:${item}`, status: "added", after: item });
    }
    return {
      baselineSnapshotId: undefined,
      entries,
      summary: "Initial generation snapshot.",
      createdAt,
    };
  }

  if (baseline.wish !== current.wish) {
    entries.push({ key: "wish", status: "changed", before: baseline.wish, after: current.wish });
  }
  if ((baseline.goalSummary ?? "") !== (current.goalSummary ?? "")) {
    entries.push({ key: "goal", status: "changed", before: baseline.goalSummary, after: current.goalSummary });
  }

  const compareSet = (prefix: string, previous: string[], next: string[]) => {
    const previousSet = new Set(previous);
    const nextSet = new Set(next);
    for (const item of next) {
      if (!previousSet.has(item)) {
        entries.push({ key: `${prefix}:${item}`, status: "added", after: item });
      }
    }
    for (const item of previous) {
      if (!nextSet.has(item)) {
        entries.push({ key: `${prefix}:${item}`, status: "removed", before: item });
      }
    }
  };

  compareSet("dod", baseline.definitionOfDone, current.definitionOfDone);
  compareSet("constraint", baseline.constraints, current.constraints);
  compareSet("domain", baseline.domainSignatures, current.domainSignatures);
  compareSet("inbox", baseline.inboxDropIds, current.inboxDropIds);

  return {
    baselineSnapshotId: baseline.snapshotId,
    entries,
    summary: entries.length === 0
      ? "No requirement changes since the last generation."
      : `${entries.length} requirement changes since the last generation.`,
    createdAt,
  };
}

export const buildRequirementDiff = diffRequirementSnapshots;

export function makeGenerationRunRecord(input: {
  state: WellState;
  candidateId?: string;
  previous?: GenerationRunRecord;
}): GenerationRunRecord {
  const snapshot = buildRequirementSnapshot(input.state);
  const diff = diffRequirementSnapshots(input.previous?.snapshot, snapshot);
  const createdAt = nowIso();
  return {
    recordId: `gen-${randomUUID().slice(0, 8)}`,
    candidateId: input.candidateId,
    snapshot,
    diff,
    createdAt,
  };
}

export function recordGenerationRun(
  state: WellState,
  input: {
    candidateId?: string;
    snapshot: RequirementSnapshot;
    diff: RequirementDiffSnapshot;
  },
): GenerationRunRecord {
  const record: GenerationRunRecord = {
    recordId: `gen-${randomUUID().slice(0, 8)}`,
    candidateId: input.candidateId,
    snapshot: input.snapshot,
    diff: input.diff,
    createdAt: nowIso(),
  };
  state.generationHistory.unshift(record);
  state.generationHistory = state.generationHistory.slice(0, 40);
  return record;
}
