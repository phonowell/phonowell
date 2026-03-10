import { randomUUID } from "node:crypto";
import type { PacketContext, PacketRecord, PacketRequest, PacketResponse, PacketStage } from "./types.js";
import { loadProviderSettings } from "./provider.js";
import { buildInstruction } from "./packet-prompt.js";
import type { PacketExecutionResult } from "./packet-executor.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildPacketRecord(input: {
  stage: PacketStage;
  context: PacketContext;
  execution: PacketExecutionResult;
}): PacketRecord {
  const { stage, context, execution } = input;
  const packetId = `packet-${randomUUID().slice(0, 8)}`;
  const request: PacketRequest = {
    packetId,
    stage,
    instruction: buildInstruction(stage, context),
    context,
    createdAt: nowIso(),
  };

  const settings = loadProviderSettings();
  const effectiveProvider = execution.usedFallback ? settings.provider : "codex-sdk";
  const effectiveWireApi = execution.usedFallback ? settings.wireApi : "codex-sdk";

  const response: PacketResponse = {
    packetId,
    stage,
    provider: effectiveProvider,
    model: settings.model,
    usedFallback: execution.usedFallback,
    outputSource: execution.structured.outputSource ?? (execution.usedFallback ? "fallback" : "model"),
    summary: `${stage} packet completed via ${execution.usedFallback ? "fallback" : `${effectiveProvider}/${effectiveWireApi}`}.`,
    outputText: execution.outputText,
    ...(stage === "generate" ? { artifactContent: execution.structured.artifactContent ?? execution.outputText } : {}),
    ...(stage === "verify"
      ? {
          verifyIssues: execution.structured.issues ?? [],
          verifySuggestions: execution.structured.suggestions ?? [],
        }
      : {}),
    structured: execution.structured,
    evidence: [
      `project-id=${context.projectId}`,
      `project-workdir=${context.projectWorkdir}`,
      `provider=${effectiveProvider}`,
      `wire-api=${effectiveWireApi}`,
      `configured-provider=${settings.provider}`,
      `configured-wire-api=${settings.wireApi}`,
      `base-url=${settings.baseUrl}`,
      `used-fallback=${String(execution.usedFallback)}`,
      `active-drops=${context.activeDropIds.length}`,
      `diff-added=${context.generationDiff?.addedDropIds.length ?? 0}`,
      `diff-changed=${context.generationDiff?.changedDropIds.length ?? 0}`,
      `diff-removed=${context.generationDiff?.removedDropIds.length ?? 0}`,
      ...execution.evidence,
    ],
    createdAt: nowIso(),
  };

  return {
    packetId,
    stage,
    request,
    response,
    createdAt: response.createdAt,
  };
}
