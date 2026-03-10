import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { CatalogAsset, Drop, Relation, RelationType, WellState } from "./types.js";
import { resolveFromAppRoot } from "../runtime-paths.js";

const ASSET_REGISTRY_FILE = resolveFromAppRoot("docs", "assets", "asset-registry.md");

function nowIso(): string {
  return new Date().toISOString();
}

function relationKey(relation: Pick<Relation, "fromDropId" | "toDropId" | "relationType">): string {
  return `${relation.fromDropId}|${relation.toDropId}|${relation.relationType}`;
}

function parseRegistryRelations(): Array<{ fromDropId: string; toDropId: string; relationType: RelationType }> {
  const content = readFileSync(ASSET_REGISTRY_FILE, "utf8");
  const lines = content.split("\n");
  const relations: Array<{ fromDropId: string; toDropId: string; relationType: RelationType }> = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].startsWith("- from: `")) {
      continue;
    }
    const fromDropId = lines[i].match(/- from: `([^`]+)`/)?.[1];
    const toDropId = lines[i + 1]?.match(/- to: `([^`]+)`/)?.[1];
    const relationType = lines[i + 2]?.match(/- relation-type: `([^`]+)`/)?.[1] as RelationType | undefined;
    if (fromDropId && toDropId && relationType) {
      relations.push({ fromDropId, toDropId, relationType });
    }
  }

  return relations;
}

function catalogAssetToDrop(asset: CatalogAsset, wellId: string, createdAt: string): Drop {
  return {
    dropId: asset.dropId,
    wellId,
    type: asset.type,
    domain: asset.domain,
    scope: asset.scope,
    source: "docs",
    owner: asset.owner,
    layer: asset.layer,
    title: asset.title,
    summary: asset.summary,
    purpose: asset.purpose,
    content: asset.summary,
    sourceFile: asset.sourceFile,
    priority: asset.priority,
    confidence: 0.95,
    licenseState: "known",
    createdAt,
    updatedAt: createdAt,
  };
}

export interface AssetImportResult {
  importedDropIds: string[];
  skippedDropIds: string[];
  importedRelationKeys: string[];
  skippedRelationKeys: string[];
}

export function importCatalogIntoState(state: WellState, catalog: CatalogAsset[]): { state: WellState; result: AssetImportResult } {
  const next = structuredClone(state);
  const createdAt = nowIso();
  const existingDropIds = new Set(next.drops.map((drop) => drop.dropId));
  const importedDropIds: string[] = [];
  const skippedDropIds: string[] = [];

  for (const asset of catalog.filter((item) => item.active)) {
    if (existingDropIds.has(asset.dropId)) {
      skippedDropIds.push(asset.dropId);
      continue;
    }
    next.drops.push(catalogAssetToDrop(asset, next.well.id, createdAt));
    existingDropIds.add(asset.dropId);
    importedDropIds.push(asset.dropId);
  }

  const existingRelationKeys = new Set(next.relations.map((relation) => relationKey(relation)));
  const importedRelationKeys: string[] = [];
  const skippedRelationKeys: string[] = [];
  for (const relation of parseRegistryRelations()) {
    const key = relationKey(relation);
    if (!existingDropIds.has(relation.fromDropId) || !existingDropIds.has(relation.toDropId)) {
      skippedRelationKeys.push(key);
      continue;
    }
    if (existingRelationKeys.has(key)) {
      skippedRelationKeys.push(key);
      continue;
    }
    next.relations.push({
      relationId: `rel-${randomUUID().slice(0, 8)}`,
      wellId: next.well.id,
      fromDropId: relation.fromDropId,
      toDropId: relation.toDropId,
      relationType: relation.relationType,
      createdAt,
    });
    existingRelationKeys.add(key);
    importedRelationKeys.push(key);
  }

  next.well.updatedAt = createdAt;
  next.pendingChangedDropIds = [...new Set([...next.pendingChangedDropIds, ...importedDropIds])];

  return {
    state: next,
    result: {
      importedDropIds,
      skippedDropIds,
      importedRelationKeys,
      skippedRelationKeys,
    },
  };
}
