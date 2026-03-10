import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AssetDomain, AssetLayer, AssetOwner, AssetScope, AssetType, CatalogAsset, Priority } from "./types.js";
import { validateCatalogAsset } from "./validator.js";
import ACTIVE_FILES from "../config/active-asset-files.json" with { type: "json" };
import { resolveFromAppRoot } from "../runtime-paths.js";

const ROOT = resolveFromAppRoot("docs", "assets");

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
const TITLE_RE = /^#\s+(.+)$/m;

function parseType(value: string | undefined): AssetType {
  switch (value) {
    case "canonical-bundle":
    case "reference-project":
    case "reference-tech":
    case "reference-tool":
    case "reference-principle":
    case "reference-engineering":
    case "goal-origin":
    case "generated-intent-hypothesis":
    case "generated-gap":
    case "note":
    case "doc":
    case "url":
    case "image":
    case "generated":
      return value;
    default:
      return "canonical-bundle";
  }
}

function parseDomain(value: string | undefined): AssetDomain {
  switch (value) {
    case "core":
    case "protocol":
    case "delivery":
    case "reference":
    case "legacy":
      return value;
    default:
      return "core";
  }
}

function parseScope(value: string | undefined): AssetScope {
  switch (value) {
    case "well-global":
    case "run-local":
      return value;
    default:
      return "well-global";
  }
}

function parseOwner(value: string | undefined): AssetOwner {
  switch (value) {
    case "product-core":
    case "orchestrator-core":
    case "delivery-core":
    case "architecture-core":
    case "webui-core":
    case "engineering-core":
    case "ux-core":
    case "user":
      return value;
    default:
      return "product-core";
  }
}

function inferLayer(type: AssetType): AssetLayer {
  if (type.startsWith("reference-")) {
    return "reference";
  }
  return "contract";
}

function parseLayer(value: string | undefined, type: AssetType): AssetLayer {
  switch (value) {
    case "contract":
    case "policy":
    case "reference":
      return value;
    default:
      return inferLayer(type);
  }
}

function extractFrontmatter(content: string): Record<string, string> {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return {};
  }
  const fields: Record<string, string> = {};
  for (const rawLine of match[1].split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const idx = line.indexOf(":");
    if (idx === -1) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    fields[key] = value;
  }
  return fields;
}

function extractPurpose(content: string): string | undefined {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.trim() === "## Purpose");
  if (start === -1) {
    return undefined;
  }
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      break;
    }
    if (line.trim().length > 0) {
      out.push(line.trim());
    }
  }
  if (!out.length) {
    return undefined;
  }
  return out.join(" ");
}

function loadOne(relativeFile: string): CatalogAsset {
  const sourceFile = resolve(ROOT, relativeFile);
  const content = readFileSync(sourceFile, "utf8");
  const meta = extractFrontmatter(content);
  const dropId = meta.dropId ?? `drop-file-${relativeFile.replace(/[^a-z0-9]+/gi, "-")}`;
  const type = parseType(meta.type);
  const domain = parseDomain(meta.domain);
  const scope = parseScope(meta.scope);
  const owner = parseOwner(meta.owner);
  const priorityRaw = meta.priority ?? "p2";
  const priority = (priorityRaw === "p0" || priorityRaw === "p1" || priorityRaw === "p2" ? priorityRaw : "p2") as Priority;
  const title = meta.title ?? content.match(TITLE_RE)?.[1]?.trim() ?? relativeFile;
  const purpose = extractPurpose(content);
  const summary = purpose ?? "Active asset with traceable implementation responsibility.";
  const layer = parseLayer(meta.layer, type);

  return {
    dropId,
    type,
    domain,
    scope,
    owner,
    layer,
    priority,
    title,
    summary,
    purpose,
    sourceFile,
    active: true,
  };
}

export function loadAssetCatalog(): CatalogAsset[] {
  return (ACTIVE_FILES as string[]).map((file) => validateCatalogAsset(loadOne(file)));
}

export function getCanonicalAssetDropIds(): string[] {
  return loadAssetCatalog()
    .filter((asset) => asset.active)
    .map((asset) => asset.dropId);
}
