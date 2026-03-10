import { randomUUID } from "node:crypto";
import type { ChangeProposal, PacketRecord } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function assessProposalGate(packet: PacketRecord): Pick<ChangeProposal, "gateStatus" | "gateReasons"> {
  const structured = packet.response.structured;
  const reasons: string[] = [];
  const patchCount = (structured?.assetPatches?.length ?? 0)
    + (structured?.relationPatches?.length ?? 0)
    + (structured?.domainPatches?.length ?? 0);
  const changedCount = structured?.changedDropIds?.length ?? 0;
  const hasArtifactContent = Boolean(structured?.artifactContent?.trim());
  const hasVerifyEvidence = Boolean((structured?.issues?.length ?? 0) || (structured?.suggestions?.length ?? 0) || (structured?.acceptanceCoverageDropIds?.length ?? 0));

  if (!structured?.summary?.trim()) {
    reasons.push("missing structured summary");
  }
  if (packet.stage === "generate" && !hasArtifactContent) {
    reasons.push("missing incremental artifact content");
  }
  if (packet.stage === "verify" && !hasVerifyEvidence) {
    reasons.push("missing verify evidence");
  }
  if (patchCount === 0 && changedCount === 0 && !hasArtifactContent) {
    reasons.push("no effective change scope");
  }

  if (reasons.length >= 2) {
    return { gateStatus: "fail", gateReasons: reasons };
  }
  if (reasons.length === 1) {
    return { gateStatus: "warn", gateReasons: reasons };
  }
  return { gateStatus: "pass", gateReasons: ["proposal has concrete scope and evidence"] };
}

export function buildProposalFromPacket(packet: PacketRecord): ChangeProposal | undefined {
  const structured = packet.response.structured;
  if (!structured) {
    return undefined;
  }
  const assetPatchCount = structured.assetPatches?.length ?? 0;
  const relationPatchCount = structured.relationPatches?.length ?? 0;
  const domainPatchCount = structured.domainPatches?.length ?? 0;
  const issueCount = structured.issues?.length ?? 0;
  const suggestionCount = structured.suggestions?.length ?? 0;
  const baseScore = Math.min(
    100,
    (assetPatchCount * 20)
    + (relationPatchCount * 12)
    + (domainPatchCount * 14)
    + (issueCount * 10)
    + (suggestionCount * 6)
    + (structured.artifactContent ? 18 : 0)
    + ((structured.changedDropIds?.length ?? 0) * 4),
  );
  const qualityScore = Math.max(20, baseScore);
  const category: ChangeProposal["category"] =
    assetPatchCount + relationPatchCount + domainPatchCount > 1
      ? "mixed"
      : assetPatchCount > 0
        ? "asset-change"
        : relationPatchCount > 0
          ? "relation-change"
          : domainPatchCount > 0
            ? "domain-change"
          : structured.artifactContent
            ? "artifact-update"
            : "verification-remediation";
  const priority: ChangeProposal["priority"] =
    qualityScore >= 80 ? "critical"
      : qualityScore >= 60 ? "high"
        : qualityScore >= 40 ? "medium"
          : "low";
  const proposalGate = assessProposalGate(packet);
  return {
    proposalId: `proposal-${randomUUID().slice(0, 8)}`,
    sourcePacketId: packet.packetId,
    stage: packet.stage,
    summary: structured.summary,
    qualityScore,
    priority,
    category,
    assetPatches: structured.assetPatches ?? [],
    relationPatches: structured.relationPatches ?? [],
    domainPatches: structured.domainPatches ?? [],
    issues: structured.issues ?? [],
    suggestions: structured.suggestions ?? [],
    changedDropIds: structured.changedDropIds ?? [],
    acceptanceCoverageDropIds: structured.acceptanceCoverageDropIds ?? [],
    artifactContent: structured.artifactContent,
    gateStatus: proposalGate.gateStatus,
    gateReasons: proposalGate.gateReasons,
    status: "proposed",
    createdAt: nowIso(),
  };
}
