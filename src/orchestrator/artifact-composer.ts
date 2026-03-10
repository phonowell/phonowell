import type { Drop } from "./types.js";

interface ComposeCandidateInput {
  wish: string;
  goalSummary: string;
  incrementalHeader: string[];
  packetArtifact: string;
  packetSummary: string;
  previousCandidateContent?: string;
  activeDrops: Drop[];
  definitionOfDone: string[];
  constraints: string[];
}

function section(title: string, lines: string[]): string[] {
  return [title, ...lines, ""];
}

function summarizeAssets(activeDrops: Drop[]): string[] {
  const core = activeDrops
    .filter((drop) => drop.priority === "p0" || drop.type === "goal-origin")
    .slice(0, 6)
    .map((drop) => `- ${drop.title}: ${drop.summary}`);
  const supporting = activeDrops
    .filter((drop) => drop.priority !== "p0" && drop.type !== "goal-origin")
    .slice(0, 8)
    .map((drop) => `- ${drop.title}: ${drop.summary}`);

  return [
    "Primary inputs",
    ...(core.length ? core : ["- none"]),
    "",
    "Supporting inputs",
    ...(supporting.length ? supporting : ["- none"]),
  ];
}

export function composeCandidateContent(input: ComposeCandidateInput): string {
  const lines: string[] = [
    `# ${input.wish}`,
    "",
    ...section("## Objective", [input.goalSummary]),
    ...section("## Delivery Draft", [
      input.packetArtifact || input.packetSummary,
    ]),
    ...section("## Change Scope", input.incrementalHeader),
    ...section("## Inputs", summarizeAssets(input.activeDrops)),
    ...section("## Acceptance Targets", input.definitionOfDone.map((item) => `- ${item}`)),
    ...section("## Constraints", input.constraints.map((item) => `- ${item}`)),
  ];

  if (input.previousCandidateContent?.trim()) {
    lines.push(...section("## Prior Draft Context", [input.previousCandidateContent.slice(0, 900)]));
  }

  return lines.join("\n").trim();
}
