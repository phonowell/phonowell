import type {
  AcceptanceCoverageEntry,
  AcceptanceEvidence,
  AcceptanceTraceLink,
  ChangedDropAcceptanceCoverage,
  Drop,
  WellState,
} from "./types.js";

function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
}

export function makeAcceptanceItemId(source: string, index: number, text: string): string {
  return `accept-${source}-${index + 1}-${stableHash(text).slice(1, 7)}`;
}

export function listAcceptanceItems(state: WellState): AcceptanceCoverageEntry[] {
  const acceptanceDrop = state.drops.find((drop) => drop.dropId === state.well.acceptanceDropId);
  const contractLines = (acceptanceDrop?.content ?? acceptanceDrop?.summary ?? "")
    .split("\n")
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter((line) => line.length >= 12)
    .slice(0, 8);

  return [
    ...state.well.definitionOfDone.map((text, index) => ({
      itemId: makeAcceptanceItemId("dod", index, text),
      title: text.trim(),
      source: "definition-of-done" as const,
      status: "uncovered" as const,
      coveredByDropIds: [],
      evidence: [],
      confidence: 0,
      uncoveredReason: "no explicit trace link",
    })),
    ...contractLines.map((text, index) => ({
      itemId: makeAcceptanceItemId("acceptance", index, text),
      title: text,
      source: "acceptance-contract" as const,
      status: "uncovered" as const,
      coveredByDropIds: [],
      evidence: [],
      confidence: 0,
      uncoveredReason: "no explicit trace link",
    })),
  ].filter((item) => item.title.length >= 8);
}

function dedupeEvidence(items: AcceptanceEvidence[]): AcceptanceEvidence[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}|${item.ref}|${item.detail}|${item.source}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function traceLinks(drop: Drop): AcceptanceTraceLink[] {
  return drop.acceptanceTraceLinks ?? [];
}

export function inferTraceLinksFromText(drop: Drop, state: WellState): AcceptanceTraceLink[] {
  const itemMap = new Map(listAcceptanceItems(state).map((item) => [item.itemId, item]));
  const explicit = new Set<string>();
  const combined = `${drop.title}\n${drop.summary}\n${drop.content ?? ""}`;
  for (const [itemId, item] of itemMap.entries()) {
    const needle = item.title.toLowerCase();
    if (needle.length >= 12 && combined.toLowerCase().includes(needle)) {
      explicit.add(itemId);
    }
  }
  return [...explicit].map((itemId) => ({
    itemId,
    source: "heuristic-link" as const,
    rationale: "text contains explicit acceptance item text",
    evidence: [
      {
        kind: "drop",
        ref: drop.dropId,
        detail: `explicit acceptance text seen in ${drop.title}`,
        source: "heuristic-link",
      },
    ],
  }));
}

export function appendAcceptanceTraceLinks(drop: Drop, links: AcceptanceTraceLink[]): void {
  const existing = traceLinks(drop);
  const byId = new Map(existing.map((link) => [link.itemId, link]));
  for (const link of links) {
    const current = byId.get(link.itemId);
    if (!current) {
      byId.set(link.itemId, {
        ...link,
        evidence: dedupeEvidence(link.evidence),
      });
      continue;
    }
    byId.set(link.itemId, {
      ...current,
      source: current.source === "manual-link" ? current.source : link.source,
      rationale: current.rationale ?? link.rationale,
      evidence: dedupeEvidence([...current.evidence, ...link.evidence]),
    });
  }
  drop.acceptanceTraceLinks = [...byId.values()];
}

export function buildAcceptanceCoverage(state: WellState, changedDropIds: string[]): {
  coverage: AcceptanceCoverageEntry[];
  changedDropCoverage: ChangedDropAcceptanceCoverage[];
  acceptanceCoverageDropIds: string[];
  uncoveredAcceptanceItemIds: string[];
} {
  const items = listAcceptanceItems(state);
  const changedDrops = changedDropIds
    .map((dropId) => state.drops.find((drop) => drop.dropId === dropId))
    .filter((drop): drop is Drop => Boolean(drop));

  const coverage = items.map<AcceptanceCoverageEntry>((item) => {
    const linkedDrops = changedDrops.filter((drop) => traceLinks(drop).some((link) => link.itemId === item.itemId));
    const evidence = dedupeEvidence(
      linkedDrops.flatMap((drop) => traceLinks(drop)
        .filter((link) => link.itemId === item.itemId)
        .flatMap((link) => link.evidence)),
    );
    return {
      itemId: item.itemId,
      title: item.title,
      source: item.source,
      status: linkedDrops.length > 0 ? "covered" : "uncovered",
      coveredByDropIds: linkedDrops.map((drop) => drop.dropId),
      evidence,
      confidence: linkedDrops.length > 0 ? Math.max(...evidence.map((entry) => entry.source === "manual-link" ? 0.96 : entry.source === "proposal-link" ? 0.88 : 0.74)) : 0,
      uncoveredReason: linkedDrops.length > 0 ? undefined : "no explicit trace link from changed assets",
    };
  });

  const changedDropCoverage = changedDrops.map<ChangedDropAcceptanceCoverage>((drop) => ({
    dropId: drop.dropId,
    acceptanceItemIds: traceLinks(drop).map((link) => link.itemId),
    evidence: dedupeEvidence(traceLinks(drop).flatMap((link) => link.evidence)),
  }));

  const acceptanceCoverageDropIds = [...new Set(coverage.flatMap((item) => item.coveredByDropIds))];
  const uncoveredAcceptanceItemIds = coverage.filter((item) => item.status === "uncovered").map((item) => item.itemId);

  return {
    coverage,
    changedDropCoverage,
    acceptanceCoverageDropIds,
    uncoveredAcceptanceItemIds,
  };
}
