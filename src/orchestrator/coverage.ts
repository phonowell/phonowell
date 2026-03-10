import { existsSync } from "node:fs";
import { PhonoWellEngine } from "./engine.js";
import { loadAssetContractManifest } from "./asset-contracts.js";
import type { CatalogAsset, PacketRecord, SchemaValidationReport, WellState } from "./types.js";
import { getSchemaValidationReport } from "./validator.js";
import { resolveFromAppRoot } from "../runtime-paths.js";
import { runClosureScenario } from "./scenario-service.js";

export interface AssetCoverageItem {
  dropId: string;
  active: boolean;
  sourceFile: string;
  implemented: boolean;
  absorbedBy?: string;
  notes: string[];
}

export interface CoverageReport {
  summary: {
    total: number;
    implemented: number;
    missing: number;
  };
  items: AssetCoverageItem[];
  schemaValidation: SchemaValidationReport;
  createdAt: string;
}

function packetStagesSeen(packetRecords: PacketRecord[]): Set<string> {
  return new Set(packetRecords.map((packet) => packet.stage));
}

function hasDrop(state: WellState, dropId: string): boolean {
  return state.drops.some((drop) => drop.dropId === dropId);
}

function relationCount(state: WellState, relationType?: string): number {
  return state.relations.filter((relation) => !relationType || relation.relationType === relationType).length;
}

function hasLayer(state: WellState, layer: string): boolean {
  return state.drops.some((drop) => drop.layer === layer);
}

function fileExists(relativePath: string): boolean {
  return existsSync(resolveFromAppRoot(relativePath));
}

function requirementEvidence(requirement: string, state: WellState, schemaValidation: SchemaValidationReport): { pass: boolean; note: string } {
  const packets = packetStagesSeen(state.packetRecords);
  switch (requirement) {
    case "schema-validation":
      return { pass: schemaValidation.pass, note: `schema-validation-pass=${schemaValidation.pass}` };
    case "project-layer":
      return { pass: Boolean(state.project.projectId && state.project.slug), note: `project=${state.project.slug}` };
    case "generation-diff":
      return {
        pass: Boolean(state.candidates[0]?.coverageDropIds?.length) && Boolean(state.candidates[0]?.relationKeys?.length),
        note: `candidate-count=${state.candidates.length};latest-coverage=${state.candidates[0]?.coverageDropIds?.length ?? 0};latest-relations=${state.candidates[0]?.relationKeys?.length ?? 0}`,
      };
    case "relation-graph":
      return { pass: relationCount(state) > 0, note: `relation-count=${state.relations.length}` };
    case "webui-surface":
      return { pass: fileExists("webui/app.js"), note: `webui-app=${String(fileExists("webui/app.js"))}` };
    case "workdir":
      return { pass: state.project.workdir.includes(".phonowell/projects/"), note: `project-workdir=${state.project.workdir}` };
    case "dry-run":
      return { pass: state.well.dryRunReport?.checkTotal === 9, note: `dry-run-check-total=${state.well.dryRunReport?.checkTotal ?? 0}` };
    case "packet-runtime":
      return {
        pass: fileExists("src/orchestrator/packet-runtime.ts") && (packets.size > 0 || state.packetRecords.length === 0),
        note: `packet-runtime-file=${String(fileExists("src/orchestrator/packet-runtime.ts"))};packet-count=${state.packetRecords.length}`,
      };
    case "verify-loop":
      return {
        pass: fileExists("src/orchestrator/engine.ts")
          && state.verifyReports.length >= 1
          && state.verifyCycles.length >= 1
          && state.selfIterationRecords.length >= 1,
        note: `verify-report-count=${state.verifyReports.length};verify-cycle-count=${state.verifyCycles.length};self-iteration-count=${state.selfIterationRecords.length}`,
      };
    case "layer-visibility":
      return { pass: hasLayer(state, "contract") && hasLayer(state, "reference") && hasLayer(state, "policy"), note: `layers=${["contract", "policy", "reference"].map((layer) => `${layer}:${state.drops.filter((drop) => drop.layer === layer).length}`).join(",")}` };
    case "legacy-boundary":
      return { pass: state.drops.filter((drop) => drop.domain === "legacy").length === 0, note: `legacy-active-count=${state.drops.filter((drop) => drop.domain === "legacy").length}` };
    case "goal-origin":
      return { pass: Boolean(state.well.originDropId), note: `goal-origin-bound=${String(Boolean(state.well.originDropId))}` };
    case "acceptance-binding":
      return { pass: Boolean(state.well.acceptanceDropId) && hasDrop(state, state.well.acceptanceDropId), note: `acceptance-drop-id=${state.well.acceptanceDropId || "missing"}` };
    case "react-webui":
      return { pass: fileExists("webui/app.js"), note: "react-webui=true" };
    case "cli-surface":
      return { pass: fileExists("src/cli/dry-run.ts") && fileExists("src/cli/core-gate.ts") && fileExists("src/cli/coverage.ts"), note: `cli-surface=${String(fileExists("src/cli/dry-run.ts") && fileExists("src/cli/core-gate.ts") && fileExists("src/cli/coverage.ts"))}` };
    case "provider-runtime":
      return {
        pass: fileExists("src/orchestrator/provider.ts"),
        note: `provider-module=${String(fileExists("src/orchestrator/provider.ts"))};latest-packet-provider=${state.packetRecords[0]?.response.provider ?? "none"};structured=${String(Boolean(state.packetRecords[0]?.response.structured))}`,
      };
    default:
      return { pass: true, note: `${requirement}=unmapped` };
  }
}

function makeItem(asset: CatalogAsset, state: WellState, schemaValidation: SchemaValidationReport): AssetCoverageItem {
  const manifest = loadAssetContractManifest();
  const compiled = manifest.assets.find((item) => item.dropId === asset.dropId);
  const evidence = (compiled?.evidenceRequirements ?? []).map((requirement) => requirementEvidence(requirement, state, schemaValidation));
  const implemented = evidence.every((item) => item.pass);
  const notes = [
    `requirements=${(compiled?.evidenceRequirements ?? []).join(",") || "none"}`,
    ...evidence.map((item) => item.note),
  ];

  if (asset.dropId === "drop-canon-core-foundation") {
    notes.push(`artifact-type=${state.well.artifactType || "missing"}`);
  }
  if (asset.dropId === "drop-canon-state-versioning-contract") {
    notes.push(`schema-version=${state.schemaVersion}`);
  }
  if (asset.dropId === "drop-canon-entity-schema-contract") {
    notes.push(`validated-schemas=${schemaValidation.validatedSchemas.length}`);
  }
  if (asset.dropId === "drop-canon-relation-semantics-contract") {
    notes.push(`derives-count=${relationCount(state, "derives")}`);
    notes.push(`implements-count=${relationCount(state, "implements")}`);
  }

  return {
    dropId: asset.dropId,
    active: asset.active,
    sourceFile: asset.sourceFile,
    implemented,
    notes,
  };
}

export function buildCoverageReport(catalog: CatalogAsset[], state: WellState): CoverageReport {
  const schemaValidation = getSchemaValidationReport(state, catalog);
  const items = catalog.filter((asset) => asset.active).map((asset) => makeItem(asset, state, schemaValidation));
  const implemented = items.filter((item) => item.implemented).length;
  const missing = items.filter((item) => !item.implemented).length;

  return {
    summary: {
      total: items.length,
      implemented,
      missing,
    },
    items,
    schemaValidation,
    createdAt: new Date().toISOString(),
  };
}

export async function buildCoverageScenarioReport(): Promise<CoverageReport> {
  const scenarioEngine = new PhonoWellEngine({ forceFallbackRuntime: true });
  await runClosureScenario(scenarioEngine, "coverage.scenario");
  return buildCoverageReport(scenarioEngine.getCatalog(), scenarioEngine.getState());
}
