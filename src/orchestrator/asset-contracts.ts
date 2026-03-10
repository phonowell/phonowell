import { readFileSync } from "node:fs";
import { resolveFromAppRoot } from "../runtime-paths.js";

export interface CompiledAssetContract {
  dropId: string;
  title: string;
  domain: string;
  layer: string;
  sourceFile: string;
  purpose: string;
  contractLines: string[];
  guardrailLines: string[];
  keywords: string[];
  evidenceRequirements: string[];
}

export interface AssetContractManifest {
  schemaVersion: string;
  compiledAt: string;
  assetCount: number;
  assets: CompiledAssetContract[];
}

const MANIFEST_FILE = resolveFromAppRoot("generated", "asset-contract-manifest.json");

export function loadAssetContractManifest(): AssetContractManifest {
  return JSON.parse(readFileSync(MANIFEST_FILE, "utf8")) as AssetContractManifest;
}
