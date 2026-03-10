import { loadAssetContractManifest } from "../../../orchestrator/asset-contracts.js";
import { loadAssetCatalog } from "../../../orchestrator/asset-catalog.js";
import { buildCoverageReport } from "../../../orchestrator/coverage.js";
import { evaluateCoreGate } from "../../../orchestrator/core-gate.js";
import { importCatalogIntoState } from "../../../orchestrator/importer.js";
import { getActiveProject, listProjects } from "../../../orchestrator/store.js";
import { getSchemaManifest } from "../../../orchestrator/index.js";
import type { ApiContext } from "../context.js";
import { json } from "../http.js";

function buildObservabilitySnapshot(ctx: ApiContext) {
  const state = ctx.engine.getState();
  const coverage = buildCoverageReport(ctx.engine.getCatalog(), state);
  const contractManifest = loadAssetContractManifest();
  const visibleDrops = state.drops.filter((drop) => drop.lifecycleState !== "archived");
  const latestCandidate = state.candidates[0] ?? null;
  const latestDiff = latestCandidate
    ? {
        baselineCandidateId: latestCandidate.candidateId,
        coveredDropCount: latestCandidate.coverageDropIds.length,
        relationCount: latestCandidate.relationKeys?.length ?? 0,
        acceptanceDropIdSnapshot: latestCandidate.acceptanceDropIdSnapshot ?? null,
        changedDropIds: state.verifyReports[0]?.changedDropIds ?? [],
        pendingChangedDropIds: state.pendingChangedDropIds,
      }
    : {
        baselineCandidateId: null,
        coveredDropCount: 0,
        relationCount: 0,
        acceptanceDropIdSnapshot: null,
        changedDropIds: [],
        pendingChangedDropIds: state.pendingChangedDropIds,
      };
  const layerCounts = visibleDrops.reduce<Record<string, number>>((acc, drop) => {
    acc[drop.layer] = (acc[drop.layer] ?? 0) + 1;
    return acc;
  }, {});
  const relationCounts = state.relations.reduce<Record<string, number>>((acc, relation) => {
    acc[relation.relationType] = (acc[relation.relationType] ?? 0) + 1;
    return acc;
  }, {});
  const latestPacket = ctx.debugMode ? ctx.engine.getPacketRecords()[0] ?? null : null;
  const latestProposal = ctx.debugMode ? ctx.engine.getProposals()[0] ?? null : null;
  const latestPacketStructuredSummary = ctx.debugMode && latestPacket?.response.structured
    ? {
        summary: latestPacket.response.structured.summary ?? "",
        changedDropCount: latestPacket.response.structured.changedDropIds?.length ?? 0,
        assetPatchCount: latestPacket.response.structured.assetPatches?.length ?? 0,
        relationPatchCount: latestPacket.response.structured.relationPatches?.length ?? 0,
        issueCount: latestPacket.response.structured.issues?.length ?? 0,
        suggestionCount: latestPacket.response.structured.suggestions?.length ?? 0,
      }
    : null;
  return {
    schemaVersion: state.schemaVersion,
    project: state.project,
    schemaManifest: getSchemaManifest(),
    dataFormatContract: contractManifest.assets.find((asset) => asset.dropId === "drop-canon-data-format-contract") ?? null,
    activeAssetCount: visibleDrops.length,
    totalAssetCount: state.drops.length,
    layerCounts,
    relationCounts,
    contractManifest: {
      schemaVersion: contractManifest.schemaVersion,
      compiledAt: contractManifest.compiledAt,
      assetCount: contractManifest.assetCount,
      layers: contractManifest.assets.reduce<Record<string, number>>((acc, asset) => {
        acc[asset.layer] = (acc[asset.layer] ?? 0) + 1;
        return acc;
      }, {}),
    },
    latestDiff,
    coverage,
    assetCoverageSummary: coverage.items.map((item) => ({
      dropId: item.dropId,
      implemented: item.implemented,
      notes: item.notes.slice(0, 4),
    })),
    latestDryRun: state.well.dryRunReport ?? null,
    latestVerify: state.verifyReports[0] ?? null,
    latestPacket,
    latestProposal,
    mainLoop: ctx.engine.getMainLoopSnapshot(),
    latestPacketStructuredSummary,
    latestStructuredApplyLog: ctx.debugMode ? state.runLogs.find((log) => log.summary === "proposal.applied") ?? null : null,
    automationTasks: state.automationTasks ?? [],
  };
}

export async function handleReadRoutes(ctx: ApiContext) {
  const { method, url, engine, persistCurrentState } = ctx;

  if (method === "GET" && url.pathname === "/api/catalog") {
    return json({ catalog: engine.getCatalog() });
  }
  if (method === "GET" && url.pathname === "/api/schema-manifest") {
    return json(getSchemaManifest());
  }
  if (method === "GET" && url.pathname === "/api/observability") {
    return json(buildObservabilitySnapshot(ctx));
  }
  if (method === "GET" && url.pathname === "/api/loop") {
    return json({ loop: engine.getMainLoopSnapshot() });
  }
  if (method === "GET" && url.pathname === "/api/projects") {
    return json({ activeProject: getActiveProject(), projects: listProjects() });
  }
  if (method === "GET" && url.pathname === "/api/coverage") {
    return json(buildCoverageReport(engine.getCatalog(), engine.getState()));
  }
  if (method === "GET" && url.pathname === "/api/core-gate") {
    const result = evaluateCoreGate(engine.getState(), engine.getCatalog());
    return json(result, result.gateResult === "fail" ? 409 : 200);
  }
  if (method === "GET" && url.pathname === "/api/packets") {
    if (!ctx.debugMode) {
      return json({ error: "debug api disabled" }, 404);
    }
    return json({ packets: engine.getPacketRecords() });
  }
  if (method === "GET" && url.pathname === "/api/proposals") {
    if (!ctx.debugMode) {
      return json({ error: "debug api disabled" }, 404);
    }
    return json({ proposals: engine.getProposals() });
  }
  if (method === "GET" && url.pathname === "/api/conversations") {
    const dropId = url.searchParams.get("dropId") ?? undefined;
    return json({ messages: engine.getConversationMessages(dropId) });
  }
  if (method === "GET" && url.pathname === "/api/state") {
    return json(engine.getState());
  }
  if (method === "POST" && url.pathname === "/api/reset-state") {
    const fresh = engine.getState();
    fresh.selfIterationRecords = [];
    fresh.pendingChangedDropIds = [];
    fresh.runLogs = [];
    fresh.candidates = [];
    fresh.proposals = [];
    fresh.verifyReports = [];
    fresh.verifyCycles = [];
    fresh.unresolvedQuestions = [];
    fresh.automationTasks = [];
    fresh.well.status = "goal-origin-init";
    fresh.well.dryRunStatus = "warn";
    fresh.well.dryRunReport = undefined;
    engine.replaceState(fresh);
    persistCurrentState();
    return json({ reset: true });
  }
  if (method === "POST" && url.pathname === "/api/state/persist") {
    persistCurrentState();
    return json({ persisted: true });
  }
  if (method === "POST" && url.pathname === "/api/import-assets") {
    const imported = importCatalogIntoState(engine.getState(), loadAssetCatalog());
    engine.replaceState(imported.state);
    persistCurrentState();
    return json(imported.result);
  }

  return undefined;
}
