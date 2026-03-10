import type { PacketContext, PacketStage } from "./types.js";

export function buildInstruction(stage: PacketStage, context: PacketContext): string {
  const head = `${stage} packet for ${context.artifactType} well ${context.wellId}`;
  const project = `project=${context.projectName}(${context.projectId})`;
  const wish = `wish=${context.wish}`;
  const dod = `dod=${context.definitionOfDone.join(" | ")}`;
  const diff = context.generationDiff
    ? `diff(add=${context.generationDiff.addedDropIds.length},change=${context.generationDiff.changedDropIds.length},remove=${context.generationDiff.removedDropIds.length})`
    : "diff(none)";
  return `${head}; ${project}; ${wish}; ${dod}; ${diff}`;
}

export function buildPacketPrompt(stage: PacketStage, context: PacketContext): string {
  return [
    `You are the phonowell ${stage} packet runtime.`,
    "Return JSON matching the provided schema.",
    "Prefer the smallest high-ROI patch set over broad rewrites.",
    "Do not restate the prompt. Emit concrete asset/relation changes when justified.",
    "If no safe patch is justified, return empty patches but still provide a precise summary.",
    `Project: ${context.projectName} (${context.projectId})`,
    `Workdir: ${context.projectWorkdir}`,
    `Well: ${context.wellId}`,
    `Artifact: ${context.artifactType}`,
    `Wish: ${context.wish}`,
    `Definition of done: ${context.definitionOfDone.join(" | ") || "none"}`,
    `Constraints: ${context.constraints.join(" | ") || "none"}`,
    `Acceptance: ${context.acceptanceSummary ?? context.acceptanceDropId ?? "none"}`,
    `Unresolved questions: ${context.unresolvedQuestions.join(" | ") || "none"}`,
    `Active drops: ${context.activeDropIds.join(", ") || "none"}`,
    `Active drop summaries: ${(context.activeDropSummaries ?? []).map((drop) => `${drop.dropId}:${drop.type}:${drop.priority}:${drop.title}:${drop.summary}`).join(" || ") || "none"}`,
    `Latest candidate summary: ${context.latestCandidateSummary ?? "none"}`,
    `Latest packet summary: ${context.latestPacketSummary ?? "none"}`,
    `Generation diff: baseline=${context.generationDiff?.baselineCandidateId ?? "none"} added=${(context.generationDiff?.addedDropIds ?? []).join(",") || "none"} changed=${(context.generationDiff?.changedDropIds ?? []).join(",") || "none"} removed=${(context.generationDiff?.removedDropIds ?? []).join(",") || "none"}`,
    `Conversation prompt: ${context.conversationPrompt ?? "none"}`,
    `Conversation target drop: ${context.conversationTargetDropId ?? "global"}`,
    "",
    "Patch quality rules:",
    "- assetPatches must be minimal and directly tied to the current wish or gate risk",
    "- use `update` when refining an existing drop, not `add`",
    "- use `add` only for missing critical assets",
    "- relationPatches should be sparse and semantically stable",
    "- for `verify`, issues and suggestions must be concrete and evidence-backed",
    "- for `generate`, `artifactContent` should be an incremental update, not a blind full rewrite",
    "",
    `Task: ${stage}`,
    stage === "analyze" ? "Analyze the current asset graph and expose critical gaps or contradictions." : "",
    stage === "gap-fill" ? "Propose the smallest set of assets or changes needed to close the critical gap." : "",
    stage === "generate" ? "Produce the artifact content update guided by the generation diff." : "",
    stage === "verify" ? "Verify acceptance coverage, self-iteration evidence, and remaining risks." : "",
  ].filter(Boolean).join("\n");
}
