import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import type { ApiContext } from "../server/api/context.js";

process.env.PHONOWELL_DISABLE_CODEX_RUNTIME = "1";

function makeReq(method: string, body?: unknown) {
  const req = new PassThrough() as PassThrough & { method?: string; url?: string };
  req.method = method;
  if (body !== undefined) {
    req.end(JSON.stringify(body));
  } else {
    req.end();
  }
  return req as unknown as IncomingMessage;
}

function makeCtx(input: {
  engine: ApiContext["engine"];
  method: string;
  path: string;
  persistCurrentState?: () => void;
  debugMode?: boolean;
  body?: unknown;
}): ApiContext {
  return {
    req: makeReq(input.method, input.body),
    method: input.method,
    url: new URL(`http://localhost:8787${input.path}`),
    engine: input.engine,
    persistCurrentState: input.persistCurrentState ?? (() => {}),
    debugMode: input.debugMode ?? false,
  };
}

async function withWorkspaceRoot<T>(label: string, run: (workspaceRoot: string) => Promise<T>): Promise<T> {
  const workspaceRoot = mkdtempSync(join(tmpdir(), label));
  const previousWorkspaceRoot = process.env.PHONOWELL_WORKSPACE_ROOT;
  process.env.PHONOWELL_WORKSPACE_ROOT = workspaceRoot;
  try {
    return await run(workspaceRoot);
  } finally {
    if (previousWorkspaceRoot === undefined) {
      delete process.env.PHONOWELL_WORKSPACE_ROOT;
    } else {
      process.env.PHONOWELL_WORKSPACE_ROOT = previousWorkspaceRoot;
    }
  }
}

test("project creation starts from a fresh project state", { concurrency: false }, async () => {
  await withWorkspaceRoot("phonowell-project-review-", async () => {
    const { handleProjectRoutes } = await import("../server/api/routes/projects.js");
    const { engine } = await import("../orchestrator/index.js");
    const { PhonoWellEngine } = await import("../orchestrator/engine.js");
    const { loadPersistedState, persistCurrentState } = await import("../orchestrator/store.js");

    engine.replaceState(new PhonoWellEngine().getState());
    engine.bootstrapInitialState();
    engine.ingestDrop({
      type: "note",
      source: "user",
      title: "Only in current project",
      summary: "This asset must not leak into a fresh project.",
      preserveOrphan: false,
    });
    engine.setWish({
      wish: "Carry-over wish that must not leak",
      definitionOfDone: ["old current project state"],
      constraints: ["no leak"],
    });
    persistCurrentState();

    const response = await handleProjectRoutes(makeCtx({
      engine,
      method: "POST",
      path: "/api/projects",
      body: { name: "Fresh Review Project" },
      persistCurrentState,
    }));

    assert.ok(response);
    assert.equal(response.status, 201);

    const state = loadPersistedState();
    assert.ok(state);
    assert.equal(state.project.slug, "fresh-review-project");
    assert.equal(state.drops.some((drop) => drop.title === "Only in current project"), false);
    assert.equal(state.well.wish, "Build phonowell WebUI V1");
  });
});

test("runtime bootstrap drains persisted pending automation tasks", { concurrency: false }, async () => {
  await withWorkspaceRoot("phonowell-bootstrap-review-", async () => {
    const { hydrateRuntimeEngine } = await import("../server/bootstrap.js");
    const { engine } = await import("../orchestrator/index.js");
    const { PhonoWellEngine } = await import("../orchestrator/engine.js");
    const { loadPersistedState, persistCurrentState } = await import("../orchestrator/store.js");

    engine.replaceState(new PhonoWellEngine().getState());
    engine.bootstrapInitialState();
    const drop = engine.ingestDrop({
      type: "note",
      source: "user",
      title: "Recover queued automation",
      summary: "This task should survive a restart and be replayed on bootstrap.",
      preserveOrphan: false,
    });
    const queuedTask = engine.schedulePostIngestAutomation(drop.dropId, "test.bootstrap-recover");
    persistCurrentState();

    engine.replaceState(new PhonoWellEngine().getState());
    const recovery = hydrateRuntimeEngine();
    const state = loadPersistedState();

    assert.equal(recovery.recoveredAutomationTaskCount >= 1, true);
    assert.ok(state);
    assert.equal(state.automationTasks.some((task) => task.taskId === queuedTask.taskId && task.status === "completed"), true);
  });
});

test("project routes can create, switch, and delete isolated projects", { concurrency: false }, async () => {
  await withWorkspaceRoot("phonowell-project-routes-", async () => {
    const { handleProjectRoutes } = await import("../server/api/routes/projects.js");
    const { engine } = await import("../orchestrator/index.js");
    const { PhonoWellEngine } = await import("../orchestrator/engine.js");
    const { listProjects, loadPersistedState, persistCurrentState } = await import("../orchestrator/store.js");

    engine.replaceState(new PhonoWellEngine().getState());
    engine.bootstrapInitialState();

    const createAlpha = await handleProjectRoutes(makeCtx({
      engine,
      method: "POST",
      path: "/api/projects",
      body: { name: "Alpha Project" },
      persistCurrentState,
    }));
    const createBeta = await handleProjectRoutes(makeCtx({
      engine,
      method: "POST",
      path: "/api/projects",
      body: { name: "Beta Project" },
      persistCurrentState,
    }));
    assert.ok(createAlpha);
    assert.ok(createBeta);

    const switched = await handleProjectRoutes(makeCtx({
      engine,
      method: "PUT",
      path: "/api/projects/alpha-project",
      persistCurrentState,
    }));
    assert.ok(switched);
    assert.equal(loadPersistedState()?.project.slug, "alpha-project");

    const deleted = await handleProjectRoutes(makeCtx({
      engine,
      method: "DELETE",
      path: "/api/projects/beta-project",
      persistCurrentState,
    }));
    const payload = JSON.parse(deleted?.body ?? "{}");

    assert.ok(deleted);
    assert.equal(payload.deleted, true);
    assert.equal(listProjects().some((project) => project.slug === "beta-project"), false);
  });
});

test("asset routes validate input and persist relation/question flows", async () => {
  const { handleAssetRoutes } = await import("../server/api/routes/assets.js");
  const engine = new (await import("../orchestrator/engine.js")).PhonoWellEngine();
  engine.bootstrapInitialState();

  const invalidCreate = await handleAssetRoutes(makeCtx({
    engine,
    method: "POST",
    path: "/api/drops",
    body: {},
  }));
  assert.ok(invalidCreate);
  assert.equal(invalidCreate.status, 400);

  const createDrop = await handleAssetRoutes(makeCtx({
    engine,
    method: "POST",
    path: "/api/drops",
    body: { text: "Track relation graph coverage from route tests." },
  }));
  assert.ok(createDrop);
  const createdPayload = JSON.parse(createDrop.body);
  const createdDropId = createdPayload.drop.dropId as string;
  const goalDropId = engine.getState().well.originDropId as string;
  assert.equal(typeof createdPayload.automation?.taskId, "string");

  const createRelation = await handleAssetRoutes(makeCtx({
    engine,
    method: "POST",
    path: "/api/relations",
    body: { fromDropId: goalDropId, toDropId: createdDropId, relationType: "references" },
  }));
  assert.ok(createRelation);
  const relationId = JSON.parse(createRelation.body).relation.relationId as string;

  const updateQuestions = await handleAssetRoutes(makeCtx({
    engine,
    method: "POST",
    path: "/api/unresolved-questions",
    body: { questions: ["route-level unresolved question"] },
  }));
  assert.ok(updateQuestions);
  assert.deepEqual(JSON.parse(updateQuestions.body).questions, ["route-level unresolved question"]);

  const removeRelation = await handleAssetRoutes(makeCtx({
    engine,
    method: "DELETE",
    path: `/api/relations/${relationId}`,
  }));
  assert.ok(removeRelation);
  assert.equal(JSON.parse(removeRelation.body).removed, true);
});

test("asset and schema loaders resolve from app root independent of cwd", { concurrency: false }, async () => {
  const previousCwd = process.cwd();
  const tempCwd = mkdtempSync(join(tmpdir(), "phonowell-app-root-review-"));
  process.chdir(tempCwd);
  try {
    const { loadAssetCatalog } = await import("../orchestrator/asset-catalog.js");
    const { loadAssetContractManifest } = await import("../orchestrator/asset-contracts.js");
    const { getSchemaManifest } = await import("../orchestrator/state-schema-service.js");

    const catalog = loadAssetCatalog();
    const manifest = loadAssetContractManifest();
    const schemaManifest = getSchemaManifest();

    assert.equal(catalog.length > 0, true);
    assert.equal(manifest.assetCount >= catalog.length, true);
    assert.match(schemaManifest.assetSchemaId, /phonowell-asset\.schema\.json$/);
    assert.match(catalog[0]?.sourceFile ?? "", /docs\/assets\//);
  } finally {
    process.chdir(previousCwd);
  }
});
