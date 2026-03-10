import type {
  AssetDomain,
  AssetOwner,
  AssetScope,
  AssetSource,
  AssetType,
  Priority,
  RelationType,
} from "./types.js";

const ASSET_TYPES = new Set<AssetType>([
  "canonical-bundle",
  "reference-project",
  "reference-tech",
  "reference-tool",
  "reference-principle",
  "reference-engineering",
  "goal-origin",
  "generated-intent-hypothesis",
  "generated-gap",
  "note",
  "doc",
  "url",
  "image",
  "generated",
]);
const ASSET_DOMAINS = new Set<AssetDomain>(["core", "protocol", "delivery", "reference", "legacy"]);
const ASSET_SCOPES = new Set<AssetScope>(["well-global", "run-local"]);
const ASSET_SOURCES = new Set<AssetSource>(["docs", "ai-generated", "user"]);
const ASSET_OWNERS = new Set<AssetOwner>([
  "product-core",
  "orchestrator-core",
  "delivery-core",
  "architecture-core",
  "webui-core",
  "engineering-core",
  "ux-core",
  "user",
]);
const PRIORITIES = new Set<Priority>(["p0", "p1", "p2"]);
const RELATION_TYPES = new Set<RelationType>(["constrains", "supports", "references", "derives", "implements"]);

function ensure(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateCreateDropInput(input: unknown): {
  type?: AssetType;
  source?: AssetSource;
  title?: string;
  summary?: string;
  content?: string;
  priority?: Priority;
  scope?: AssetScope;
  domain?: AssetDomain;
  owner?: AssetOwner;
  parentDropId?: string;
  x?: number;
  y?: number;
  text?: string;
  fileName?: string;
  fileContent?: string;
  mimeType?: string;
  skipAutoFlow?: boolean;
} {
  if (!isObject(input)) {
    throw new Error("drop payload must be an object");
  }
  const body: Record<string, unknown> = input;
  const hasText = typeof body.text === "string" && body.text.trim().length > 0;
  const hasFile = typeof body.fileContent === "string" && body.fileContent.trim().length > 0;
  const hasLegacyShape = typeof body.title === "string" && body.title.trim().length > 0
    && typeof body.summary === "string" && body.summary.trim().length > 0;
  ensure(hasText || hasFile || hasLegacyShape, "drop payload requires text, fileContent, or title+summary");
  if (body.type !== undefined) ensure(typeof body.type === "string" && ASSET_TYPES.has(body.type as AssetType), "drop payload has invalid type");
  if (body.source !== undefined) ensure(typeof body.source === "string" && ASSET_SOURCES.has(body.source as AssetSource), "drop payload has invalid source");
  if (body.priority !== undefined) ensure(typeof body.priority === "string" && PRIORITIES.has(body.priority as Priority), "drop payload has invalid priority");
  if (body.scope !== undefined) ensure(typeof body.scope === "string" && ASSET_SCOPES.has(body.scope as AssetScope), "drop payload has invalid scope");
  if (body.domain !== undefined) ensure(typeof body.domain === "string" && ASSET_DOMAINS.has(body.domain as AssetDomain), "drop payload has invalid domain");
  if (body.owner !== undefined) ensure(typeof body.owner === "string" && ASSET_OWNERS.has(body.owner as AssetOwner), "drop payload has invalid owner");
  if (body.parentDropId !== undefined) ensure(typeof body.parentDropId === "string", "drop payload has invalid parentDropId");
  if (body.content !== undefined) ensure(typeof body.content === "string", "drop payload has invalid content");
  if (body.text !== undefined) ensure(typeof body.text === "string", "drop payload has invalid text");
  if (body.fileName !== undefined) ensure(typeof body.fileName === "string", "drop payload has invalid fileName");
  if (body.fileContent !== undefined) ensure(typeof body.fileContent === "string", "drop payload has invalid fileContent");
  if (body.mimeType !== undefined) ensure(typeof body.mimeType === "string", "drop payload has invalid mimeType");
  if (body.skipAutoFlow !== undefined) ensure(typeof body.skipAutoFlow === "boolean", "drop payload has invalid skipAutoFlow");
  if (body.x !== undefined) ensure(typeof body.x === "number" && Number.isFinite(body.x), "drop payload has invalid x");
  if (body.y !== undefined) ensure(typeof body.y === "number" && Number.isFinite(body.y), "drop payload has invalid y");
  return body as ReturnType<typeof validateCreateDropInput>;
}

export function validateUpdateDropInput(input: unknown): {
  title?: string;
  summary?: string;
  position?: { x: number; y: number };
  skipAutoFlow?: boolean;
} {
  if (!isObject(input)) {
    throw new Error("drop update payload must be an object");
  }
  const body: Record<string, unknown> = input;
  const hasChange =
    body.title !== undefined
    || body.summary !== undefined
    || body.position !== undefined;
  ensure(hasChange, "drop update payload requires title, summary, or position");
  if (body.title !== undefined) ensure(typeof body.title === "string", "drop update payload has invalid title");
  if (body.summary !== undefined) ensure(typeof body.summary === "string", "drop update payload has invalid summary");
  if (body.position !== undefined) {
    ensure(isObject(body.position), "drop update payload has invalid position");
    const position = body.position as Record<string, unknown>;
    ensure(typeof position.x === "number" && Number.isFinite(position.x), "drop update payload has invalid position.x");
    ensure(typeof position.y === "number" && Number.isFinite(position.y), "drop update payload has invalid position.y");
  }
  if (body.skipAutoFlow !== undefined) ensure(typeof body.skipAutoFlow === "boolean", "drop update payload has invalid skipAutoFlow");
  return body as ReturnType<typeof validateUpdateDropInput>;
}

export function validateRelationInput(input: unknown): { fromDropId: string; toDropId: string; relationType?: RelationType } {
  if (!isObject(input)) {
    throw new Error("relation payload must be an object");
  }
  const body: Record<string, unknown> = input;
  ensure(typeof body.fromDropId === "string" && body.fromDropId.trim().length > 0, "relation payload missing fromDropId");
  ensure(typeof body.toDropId === "string" && body.toDropId.trim().length > 0, "relation payload missing toDropId");
  if (body.relationType !== undefined) {
    ensure(typeof body.relationType === "string" && RELATION_TYPES.has(body.relationType as RelationType), "relation payload has invalid relationType");
  }
  return body as { fromDropId: string; toDropId: string; relationType?: RelationType };
}

export function validateGoalInput(input: unknown): { title?: string; summary?: string; status?: "draft" | "confirmed" | "revised" } {
  if (!isObject(input)) {
    throw new Error("goal payload must be an object");
  }
  const body: Record<string, unknown> = input;
  if (body.title !== undefined) ensure(typeof body.title === "string", "goal payload has invalid title");
  if (body.summary !== undefined) ensure(typeof body.summary === "string", "goal payload has invalid summary");
  if (body.status !== undefined) ensure(body.status === "draft" || body.status === "confirmed" || body.status === "revised", "goal payload has invalid status");
  return body as { title?: string; summary?: string; status?: "draft" | "confirmed" | "revised" };
}

export function validateProjectCreateInput(input: unknown): { name?: string } {
  if (!isObject(input)) {
    throw new Error("project payload must be an object");
  }
  const body: Record<string, unknown> = input;
  if (body.name !== undefined) ensure(typeof body.name === "string", "project payload has invalid name");
  return body as { name?: string };
}

export function validateWishInput(input: unknown): { wish?: string; definitionOfDone?: string[]; constraints?: string[] } {
  if (!isObject(input)) {
    throw new Error("wish payload must be an object");
  }
  const body: Record<string, unknown> = input;
  if (body.wish !== undefined) ensure(typeof body.wish === "string", "wish payload has invalid wish");
  if (body.definitionOfDone !== undefined) ensure(Array.isArray(body.definitionOfDone) && body.definitionOfDone.every((item) => typeof item === "string"), "wish payload has invalid definitionOfDone");
  if (body.constraints !== undefined) ensure(Array.isArray(body.constraints) && body.constraints.every((item) => typeof item === "string"), "wish payload has invalid constraints");
  return body as { wish?: string; definitionOfDone?: string[]; constraints?: string[] };
}

export function validateQuestionsInput(input: unknown): { questions?: string[] } {
  if (!isObject(input)) {
    throw new Error("questions payload must be an object");
  }
  const body: Record<string, unknown> = input;
  if (body.questions !== undefined) ensure(Array.isArray(body.questions) && body.questions.every((item) => typeof item === "string"), "questions payload has invalid questions");
  return body as { questions?: string[] };
}

export function validateAutoFlowInput(input: unknown): { trigger?: string } {
  if (!isObject(input)) {
    throw new Error("auto-flow payload must be an object");
  }
  const body: Record<string, unknown> = input;
  if (body.trigger !== undefined) ensure(typeof body.trigger === "string", "auto-flow payload has invalid trigger");
  return body as { trigger?: string };
}

export function validatePacketStage(stage: string): "analyze" | "gap-fill" | "generate" | "verify" {
  switch (stage) {
    case "analyze":
    case "gap-fill":
    case "generate":
    case "verify":
      return stage;
    default:
      throw new Error("invalid packet stage");
  }
}
