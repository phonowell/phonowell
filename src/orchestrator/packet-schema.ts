import type { PacketStage } from "./types.js";

export function outputSchemaFor(stage: PacketStage): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "changedDropIds", "assetPatches", "relationPatches", "domainPatches"],
    properties: {
      summary: { type: "string" },
      artifactContent: { type: "string" },
      issues: { type: "array", items: { type: "string" } },
      suggestions: { type: "array", items: { type: "string" } },
      changedDropIds: { type: "array", items: { type: "string" } },
      acceptanceCoverageDropIds: { type: "array", items: { type: "string" } },
      assetPatches: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["action", "title", "summary"],
          properties: {
            action: { type: "string", enum: ["add", "update", "archive"] },
            dropId: { type: "string" },
            type: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            content: { type: "string" },
            purpose: { type: "string" },
            domain: { type: "string" },
            scope: { type: "string" },
            owner: { type: "string" },
            layer: { type: "string" },
            priority: { type: "string" },
            parentDropId: { type: "string" },
          },
        },
      },
      relationPatches: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["action", "fromDropId", "toDropId", "relationType"],
          properties: {
            action: { type: "string", enum: ["add", "remove"] },
            fromDropId: { type: "string" },
            toDropId: { type: "string" },
            relationType: { type: "string" },
          },
        },
      },
      domainPatches: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["action", "domainId"],
          properties: {
            action: { type: "string", enum: ["update"] },
            domainId: { type: "string" },
            name: { type: "string" },
            summary: { type: "string" },
          },
        },
      },
    },
    ...(stage === "generate" ? { required: ["summary", "artifactContent", "changedDropIds", "assetPatches", "relationPatches", "domainPatches"] } : {}),
    ...(stage === "verify" ? { required: ["summary", "issues", "suggestions", "changedDropIds", "acceptanceCoverageDropIds", "assetPatches", "relationPatches", "domainPatches"] } : {}),
  };
}
