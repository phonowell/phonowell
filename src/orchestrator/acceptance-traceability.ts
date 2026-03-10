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

const ACCEPTANCE_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "before",
  "by",
  "can",
  "conditions",
  "defines",
  "done",
  "for",
  "how",
  "in",
  "is",
  "it",
  "means",
  "must",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "truth",
  "what",
  "with",
]);

function normalizeToken(token: string): string {
  if (token === "verified" || token === "verification") {
    return "verify";
  }
  if (token === "generated" || token === "generation") {
    return "generate";
  }
  if (token === "running" || token === "runnable") {
    return "run";
  }
  if (token === "editing") {
    return "edit";
  }
  if (token === "confirming" || token === "confirmed") {
    return "confirm";
  }
  return token;
}

function tokenizeForAcceptance(input: string): string[] {
  return [...input.toLowerCase().matchAll(/[a-z0-9]+/g)]
    .map((match) => normalizeToken(match[0]))
    .filter((token) => token.length >= 3 && !ACCEPTANCE_STOPWORDS.has(token));
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

export function inferTraceLinksFromKeywords(drop: Drop, state: WellState): AcceptanceTraceLink[] {
  const combined = `${drop.title}\n${drop.summary}\n${drop.content ?? ""}`;
  const dropTokens = new Set(tokenizeForAcceptance(combined));
  if (dropTokens.size === 0) {
    return [];
  }

  return listAcceptanceItems(state).flatMap((item) => {
    const itemTokens = [...new Set(tokenizeForAcceptance(item.title))];
    if (itemTokens.length === 0) {
      return [];
    }
    const shared = itemTokens.filter((token) => dropTokens.has(token));
    const coverageRatio = shared.length / itemTokens.length;
    if (shared.length < 2 || coverageRatio < 0.3) {
      return [];
    }
    return [{
      itemId: item.itemId,
      source: "heuristic-link" as const,
      rationale: `keyword overlap with acceptance item: ${shared.slice(0, 4).join(", ")}`,
      evidence: [{
        kind: "drop" as const,
        ref: drop.dropId,
        detail: `acceptance keyword overlap: ${shared.slice(0, 4).join(", ")}`,
        source: "heuristic-link" as const,
      }],
    }];
  });
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

export function refreshAcceptanceTraceLinks(drop: Drop, state: WellState): boolean {
  const preserved = traceLinks(drop)
    .filter((link) => link.source === "manual-link" || link.source === "proposal-link")
    .map((link) => ({
      ...link,
      evidence: dedupeEvidence(link.evidence),
    }));
  const draft: Drop = {
    ...drop,
    acceptanceTraceLinks: preserved,
  };
  appendAcceptanceTraceLinks(draft, inferTraceLinksFromText(drop, state));
  appendAcceptanceTraceLinks(draft, inferTraceLinksFromKeywords(drop, state));

  const previous = JSON.stringify(traceLinks(drop));
  const next = JSON.stringify(draft.acceptanceTraceLinks ?? []);
  drop.acceptanceTraceLinks = draft.acceptanceTraceLinks ?? [];
  return previous !== next;
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
