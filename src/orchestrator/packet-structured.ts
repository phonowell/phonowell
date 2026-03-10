import type { PacketContext, PacketStage, PacketStructuredOutput } from "./types.js";

export interface StructuredOutputParseResult {
  structured: PacketStructuredOutput;
  usedFallback: boolean;
}

export function enrichStructuredOutput(stage: PacketStage, context: PacketContext, structured: PacketStructuredOutput): PacketStructuredOutput {
  const next = { ...structured };
  const changedDropIds = new Set(next.changedDropIds ?? []);
  const provenanceNotes = [...(next.provenanceNotes ?? [])];
  for (const dropId of context.generationDiff?.changedDropIds ?? []) changedDropIds.add(dropId);

  const activeSummaries = context.activeDropSummaries ?? [];
  const hasGoalUpdate = activeSummaries.some((drop) => drop.type === "goal-origin" && drop.summary.trim().length >= 12);

  if (stage === "analyze" && (next.assetPatches?.length ?? 0) === 0 && context.unresolvedQuestions.length > 0) {
    next.assetPatches = [
      ...(next.assetPatches ?? []),
      {
        action: "add",
        type: "generated-gap",
        title: "Conflict Resolution Gap",
        summary: context.unresolvedQuestions[0],
        purpose: "Expose the highest ROI contradiction as an explicit gap asset.",
        domain: "delivery",
        scope: "run-local",
        owner: "delivery-core",
        layer: "contract",
        priority: "p1",
        parentDropId: context.activeDropSummaries?.find((drop) => drop.type === "goal-origin")?.dropId,
      },
    ];
    provenanceNotes.push("system added conflict gap patch because unresolved questions were present");
  }

  if (stage === "gap-fill" && (next.assetPatches?.length ?? 0) === 0) {
    const needRuntimeEvidence = !activeSummaries.some((drop) => /runtime packet|packet evidence|structured packet/i.test(drop.summary));
    if (needRuntimeEvidence) {
      next.assetPatches = [
        ...(next.assetPatches ?? []),
        {
          action: "add",
          type: "generated-gap",
          title: "Structured Packet Evidence",
          summary: "Missing explicit packet evidence and patch-quality signals for the current graph.",
          purpose: "Create a high-ROI gap asset so generate/verify can converge on explicit runtime evidence.",
          domain: "delivery",
          scope: "run-local",
          owner: "delivery-core",
          layer: "contract",
          priority: "p1",
          parentDropId: context.activeDropSummaries?.find((drop) => drop.type === "goal-origin")?.dropId,
        },
      ];
      provenanceNotes.push("system added runtime evidence gap patch because no packet evidence asset was present");
    }
  }

  if (stage === "verify") {
    const issues = [...(next.issues ?? [])];
    const suggestions = [...(next.suggestions ?? [])];
    if (issues.length === 0 && (next.assetPatches?.length ?? 0) === 0 && (next.relationPatches?.length ?? 0) === 0) {
      issues.push("verify produced no concrete patch or remediation evidence");
      suggestions.push("add at least one focused asset update or remediation patch for the highest ROI gap");
      provenanceNotes.push("system added verify issue because verify returned no remediation evidence");
    }
    if ((next.acceptanceCoverageDropIds?.length ?? 0) === 0 && context.acceptanceDropId) {
      next.acceptanceCoverageDropIds = [context.acceptanceDropId];
    }
    next.issues = issues;
    next.suggestions = suggestions;
  }

  if (stage === "generate" && !next.artifactContent) {
    next.artifactContent = [
      `# ${context.wish}`,
      "",
      "## Incremental Artifact Update",
      `- baseline-candidate: ${context.generationDiff?.baselineCandidateId ?? "none"}`,
      `- changed-drops: ${[...changedDropIds].join(", ") || "none"}`,
      `- goal-updated: ${String(hasGoalUpdate)}`,
    ].join("\n");
    provenanceNotes.push("system synthesized incremental artifact scaffold because model output had no artifact content");
  }

  next.changedDropIds = [...changedDropIds];
  if (!next.summary || next.summary.trim().length < 24) {
    next.summary = `${stage} packet processed ${next.changedDropIds.length} changed drops with ${next.assetPatches?.length ?? 0} asset patches and ${next.relationPatches?.length ?? 0} relation patches.`;
  }
  next.assetPatches = next.assetPatches ?? [];
  next.relationPatches = next.relationPatches ?? [];
  next.outputSource = next.outputSource ?? "model";
  next.provenanceNotes = provenanceNotes;
  return next;
}

export function buildFallbackStructured(stage: PacketStage, context: PacketContext): PacketStructuredOutput {
  switch (stage) {
    case "analyze":
      return {
        summary: `Analyze active drops for convergence around "${context.wish}" and expose missing clarity.`,
        changedDropIds: context.generationDiff?.changedDropIds ?? [],
        assetPatches: [],
        relationPatches: [],
        outputSource: "fallback",
        provenanceNotes: ["fallback analyze output generated because model execution failed"],
      };
    case "gap-fill":
      return {
        summary: `Gap-fill critical missing capabilities for "${context.wish}" before generation.`,
        changedDropIds: context.generationDiff?.changedDropIds ?? [],
        assetPatches: [],
        relationPatches: [],
        outputSource: "fallback",
        provenanceNotes: ["fallback gap-fill output generated because model execution failed"],
      };
    case "generate":
      return {
        summary: `Generate incremental artifact update for "${context.wish}".`,
        artifactContent: [
          `# ${context.wish}`,
          "",
          "## Draft",
          "This draft captures the current delivery objective and the latest requested changes.",
          "",
          "## Requested Changes",
          `- added inputs: ${context.generationDiff?.addedDropIds.length ?? 0}`,
          `- changed inputs: ${context.generationDiff?.changedDropIds.length ?? 0}`,
          `- removed inputs: ${context.generationDiff?.removedDropIds.length ?? 0}`,
          "",
          "## Acceptance Targets",
          ...context.definitionOfDone.map((item) => `- ${item}`),
          "",
          "## Constraints",
          ...context.constraints.map((item) => `- ${item}`),
        ].join("\n"),
        changedDropIds: [
          ...(context.generationDiff?.addedDropIds ?? []),
          ...(context.generationDiff?.changedDropIds ?? []),
        ],
        assetPatches: [],
        relationPatches: [],
        outputSource: "fallback",
        provenanceNotes: ["fallback generate output generated because model execution failed"],
      };
    case "verify":
      return {
        summary: `Verify acceptance coverage and self-iteration evidence for "${context.wish}".`,
        issues: [],
        suggestions: [],
        changedDropIds: context.generationDiff?.changedDropIds ?? [],
        acceptanceCoverageDropIds: [],
        assetPatches: [],
        relationPatches: [],
        outputSource: "fallback",
        provenanceNotes: ["fallback verify output generated because model execution failed"],
      };
    default:
      return {
        summary: `${stage} completed.`,
        changedDropIds: [],
        assetPatches: [],
        relationPatches: [],
        outputSource: "fallback",
        provenanceNotes: ["fallback packet output generated because model execution failed"],
      };
  }
}

export function parseStructuredOutput(raw: string, fallback: PacketStructuredOutput): StructuredOutputParseResult {
  try {
    const parsed = JSON.parse(raw) as PacketStructuredOutput;
    return {
      usedFallback: false,
      structured: {
        summary: typeof parsed.summary === "string" ? parsed.summary : fallback.summary,
        ...(typeof parsed.artifactContent === "string" ? { artifactContent: parsed.artifactContent } : {}),
        ...(Array.isArray(parsed.issues) ? { issues: parsed.issues.filter((item) => typeof item === "string") } : {}),
        ...(Array.isArray(parsed.suggestions) ? { suggestions: parsed.suggestions.filter((item) => typeof item === "string") } : {}),
        changedDropIds: Array.isArray(parsed.changedDropIds) ? parsed.changedDropIds.filter((item) => typeof item === "string") : fallback.changedDropIds ?? [],
        ...(Array.isArray(parsed.acceptanceCoverageDropIds) ? { acceptanceCoverageDropIds: parsed.acceptanceCoverageDropIds.filter((item) => typeof item === "string") } : {}),
        assetPatches: Array.isArray(parsed.assetPatches) ? parsed.assetPatches : [],
        relationPatches: Array.isArray(parsed.relationPatches) ? parsed.relationPatches : [],
        outputSource: "model",
        ...(Array.isArray(parsed.provenanceNotes) ? { provenanceNotes: parsed.provenanceNotes.filter((item) => typeof item === "string") } : {}),
      },
    };
  } catch {
    return {
      structured: fallback,
      usedFallback: true,
    };
  }
}
