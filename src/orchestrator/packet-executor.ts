import { Codex, type ThreadEvent, type ThreadItem, type Usage } from "@openai/codex-sdk";
import type { PacketContext, PacketRunOptions, PacketStage, PacketStructuredOutput } from "./types.js";
import { loadProviderSettings } from "./provider.js";
import { buildPacketPrompt } from "./packet-prompt.js";
import { outputSchemaFor } from "./packet-schema.js";
import { buildFallbackStructured, enrichStructuredOutput, parseStructuredOutput } from "./packet-structured.js";

const PACKET_TIMEOUT_MS = Number(process.env.PHONOWELL_PACKET_TIMEOUT_MS ?? 20000);
const codexClient = new Codex();

export interface PacketExecutionResult {
  outputText: string;
  structured: PacketStructuredOutput;
  usedFallback: boolean;
  evidence: string[];
}

function isAgentMessageItem(item: ThreadItem): item is Extract<ThreadItem, { type: "agent_message" }> {
  return item.type === "agent_message";
}

function formatUsageEvidence(usage: Usage | null | undefined): string[] {
  if (!usage) {
    return ["usage=unavailable"];
  }
  return [
    `usage-input=${usage.input_tokens}`,
    `usage-cached-input=${usage.cached_input_tokens}`,
    `usage-output=${usage.output_tokens}`,
  ];
}

async function collectStreamedTurn(events: AsyncGenerator<ThreadEvent>): Promise<{
  outputText?: string;
  usage?: Usage | null;
}> {
  let latestOutput = "";
  let completedOutput = "";
  let usage: Usage | null | undefined;

  for await (const event of events) {
    if (event.type === "item.updated" || event.type === "item.completed") {
      const item = event.item;
      if (isAgentMessageItem(item) && item.text.trim()) {
        latestOutput = item.text.trim();
        if (event.type === "item.completed") {
          completedOutput = latestOutput;
        }
      }
      continue;
    }
    if (event.type === "turn.completed") {
      usage = event.usage;
      continue;
    }
    if (event.type === "turn.failed") {
      throw new Error(event.error.message || "codex turn failed");
    }
    if (event.type === "error") {
      throw new Error(event.message || "codex stream error");
    }
  }

  return {
    outputText: completedOutput || latestOutput || undefined,
    usage,
  };
}

export async function executePacket(
  stage: PacketStage,
  context: PacketContext,
  options: PacketRunOptions = {},
): Promise<PacketExecutionResult> {
  const settings = loadProviderSettings();
  const prompt = buildPacketPrompt(stage, context);
  const fallback = buildFallbackStructured(stage, context);
  if (options.forceFallback || process.env.PHONOWELL_DISABLE_CODEX_RUNTIME === "1") {
    const structured = enrichStructuredOutput(stage, context, fallback);
    return {
      outputText: JSON.stringify(structured),
      structured,
      usedFallback: true,
      evidence: [
        "output-source=fallback",
        `forced-fallback=${String(Boolean(options.forceFallback))}`,
        `runtime-disabled-by-env=${String(process.env.PHONOWELL_DISABLE_CODEX_RUNTIME === "1")}`,
      ],
    };
  }
  try {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort(new Error(`packet_timeout_${PACKET_TIMEOUT_MS}ms`));
        reject(new Error(`packet_timeout_${PACKET_TIMEOUT_MS}ms`));
      }, PACKET_TIMEOUT_MS);
    });
    const thread = codexClient.startThread({
      workingDirectory: context.projectWorkdir,
      skipGitRepoCheck: true,
      sandboxMode: "read-only",
      approvalPolicy: "never",
      modelReasoningEffort: "minimal",
      ...(settings.model !== "codex-default" ? { model: settings.model } : {}),
    });
    try {
      const result = await Promise.race([
        (async () => {
          const streamed = await thread.runStreamed(prompt, { signal: controller.signal, outputSchema: outputSchemaFor(stage) });
          return collectStreamedTurn(streamed.events);
        })(),
        timeoutPromise,
      ]);
      const rawOutputText = result.outputText?.trim();
      const parsed = rawOutputText
        ? parseStructuredOutput(rawOutputText, fallback)
        : { structured: fallback, usedFallback: true };
      const outputText = rawOutputText || JSON.stringify(fallback);
      const structured = enrichStructuredOutput(stage, context, parsed.structured);
      const usedFallback = parsed.usedFallback;

      return {
        outputText,
        structured,
        usedFallback,
        evidence: [
          "wire-api=codex-sdk",
          `thread-id=${thread.id ?? "unknown"}`,
          `timeout-ms=${PACKET_TIMEOUT_MS}`,
          "reasoning-effort=minimal",
          `asset-patch-count=${structured.assetPatches?.length ?? 0}`,
          `relation-patch-count=${structured.relationPatches?.length ?? 0}`,
          `issue-count=${structured.issues?.length ?? 0}`,
          `output-source=${structured.outputSource ?? "model"}`,
          `parse-fallback=${String(usedFallback)}`,
          ...formatUsageEvidence(result.usage),
        ],
      };
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  } catch (error) {
    return {
      outputText: JSON.stringify(fallback),
      structured: enrichStructuredOutput(stage, context, fallback),
      usedFallback: true,
      evidence: [
        `timeout-ms=${PACKET_TIMEOUT_MS}`,
        `asset-patch-count=${fallback.assetPatches?.length ?? 0}`,
        `relation-patch-count=${fallback.relationPatches?.length ?? 0}`,
        "output-source=fallback",
        `error=${String((error as Error).message)}`,
      ],
    };
  }
}
