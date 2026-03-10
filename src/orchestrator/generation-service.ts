import { randomUUID } from "node:crypto";
import { composeCandidateContent } from "./artifact-composer.js";
import type { CandidateArtifact, PacketRecord, Relation, WellState } from "./types.js";

function relationKey(rel: Pick<Relation, "fromDropId" | "toDropId" | "relationType">): string {
  return `${rel.fromDropId}|${rel.toDropId}|${rel.relationType}`;
}

function buildIncrementalHeader(state: WellState, packet: PacketRecord): string[] {
  const previousCandidate = state.candidates[0];
  const diff = packet.request.context.generationDiff;

  return previousCandidate
    ? [
        "## Incremental Update",
        "- mode: incremental",
        `- baseline-candidate: ${previousCandidate.candidateId}`,
        `- added-assets: ${(diff?.addedDropIds ?? []).join(", ") || "none"}`,
        `- changed-assets: ${(diff?.changedDropIds ?? []).join(", ") || "none"}`,
        `- removed-assets: ${(diff?.removedDropIds ?? []).join(", ") || "none"}`,
        `- changed-relations: ${diff?.relationDeltaCount ?? 0}`,
        `- changed-well-fields: ${(diff?.changedWellFields ?? []).join(", ") || "none"}`,
      ]
    : [
        "## Incremental Update",
        "- mode: initial",
        `- baseline-candidate: ${diff?.baselineCandidateId ?? "none"}`,
        `- added-assets: ${(diff?.addedDropIds ?? []).join(", ") || "none"}`,
        `- changed-assets: ${(diff?.changedDropIds ?? []).join(", ") || "none"}`,
        `- removed-assets: ${(diff?.removedDropIds ?? []).join(", ") || "none"}`,
      ];
}

export function buildCandidateArtifact(state: WellState, packet: PacketRecord): CandidateArtifact {
  const activeDrops = state.drops;
  const goal = activeDrops.find((drop) => drop.type === "goal-origin");
  const previousCandidate = state.candidates[0];
  const packetArtifact = packet.response.artifactContent?.trim() || packet.response.outputText.trim();
  const content = composeCandidateContent({
    wish: state.well.wish,
    goalSummary: goal?.summary ?? "N/A",
    incrementalHeader: buildIncrementalHeader(state, packet),
    packetArtifact,
    packetSummary: packet.response.summary,
    previousCandidateContent: previousCandidate?.content,
    activeDrops,
    definitionOfDone: state.well.definitionOfDone,
    constraints: state.well.constraints,
  });

  return {
    candidateId: `candidate-${randomUUID().slice(0, 8)}`,
    wellId: state.well.id,
    content,
    coverageDropIds: activeDrops.map((drop) => drop.dropId),
    relationKeys: state.relations.map((rel) => relationKey(rel)),
    wishSnapshot: state.well.wish,
    definitionOfDoneSnapshot: [...state.well.definitionOfDone],
    constraintsSnapshot: [...state.well.constraints],
    acceptanceDropIdSnapshot: state.well.acceptanceDropId,
    packetId: packet.packetId,
    createdAt: new Date().toISOString(),
  };
}
