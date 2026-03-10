import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import { PhonoWellEngine } from "../orchestrator/engine.js";
import { handleAssetRoutes } from "../server/api/routes/assets.js";
import { handleReadRoutes } from "../server/api/routes/read.js";
import { handleRuntimeRoutes } from "../server/api/routes/runtime.js";
import type { ApiContext } from "../server/api/context.js";

process.env.PHONOWELL_DISABLE_CODEX_RUNTIME = "1";
const execFileAsync = promisify(execFile);

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
  engine: PhonoWellEngine;
  method: string;
  path: string;
  debugMode?: boolean;
  body?: unknown;
}): ApiContext {
  return {
    req: makeReq(input.method, input.body),
    method: input.method,
    url: new URL(`http://localhost:8787${input.path}`),
    engine: input.engine,
    persistCurrentState: () => {},
    debugMode: input.debugMode ?? false,
  };
}

test("observability hides packet and proposal details when debug api is disabled", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  await engine.runDeepOrganize("test.observability");

  const response = await handleReadRoutes(makeCtx({
    engine,
    method: "GET",
    path: "/api/observability",
    debugMode: false,
  }));

  assert.ok(response);
  const payload = JSON.parse(response.body);
  assert.equal(payload.latestPacket, null);
  assert.equal(payload.latestProposal, null);
  assert.equal(payload.latestPacketStructuredSummary, null);
  assert.equal(payload.latestStructuredApplyLog, null);
});

test("observability exposes packet and proposal details in debug mode", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  await engine.runDeepOrganize("test.observability.debug");

  const response = await handleReadRoutes(makeCtx({
    engine,
    method: "GET",
    path: "/api/observability",
    debugMode: true,
  }));

  assert.ok(response);
  const payload = JSON.parse(response.body);
  assert.ok(payload.latestPacket);
  assert.ok(payload.latestProposal);
});

test("cycle route is gated behind debug mode", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();

  const response = await handleRuntimeRoutes(makeCtx({
    engine,
    method: "POST",
    path: "/api/cycle",
    debugMode: false,
  }));

  assert.ok(response);
  assert.equal(response.status, 404);
  assert.match(response.body, /debug api disabled/);
});

test("assistant loop route is public and returns one primary action", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  let persistCalls = 0;

  const response = await handleRuntimeRoutes({
    ...makeCtx({
      engine,
      method: "POST",
      path: "/api/assistant-loop",
      body: { trigger: "test.public-loop" },
    }),
    persistCurrentState: () => {
      persistCalls += 1;
    },
  });

  assert.ok(response);
  assert.equal(response.status, 200);
  assert.equal(persistCalls, 1);
  const payload = JSON.parse(response.body);
  assert.equal(payload.loop.status, "blocked");
  assert.equal(payload.loop.primaryAction.key, "add-material");
  assert.equal(typeof payload.loop.primaryAction.label, "string");
  assert.equal(typeof payload.loop.primaryAction.detail, "string");
});

test("accept-direction route persists an explicit acceptance decision", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Accepted material",
    summary: "Enough material exists for an explicit acceptance decision.",
    preserveOrphan: false,
  });
  const state = engine.getState();
  state.well.acceptanceStatus = "pending";
  state.pendingChangedDropIds = [];
  state.candidates.unshift({
    candidateId: "candidate-ready",
    wellId: state.well.id,
    content: "ready candidate",
    coverageDropIds: state.drops.map((drop) => drop.dropId),
    createdAt: new Date().toISOString(),
  });
  state.verifyReports.unshift({
    pass: true,
    issues: [],
    suggestions: [],
    acceptanceCoverageDropIds: [state.well.acceptanceDropId],
    acceptanceItems: [],
    changedDropCoverage: [],
    uncoveredAcceptanceItemIds: [],
    selfIterationEvidence: ["run-1:verify:pass"],
    changedDropIds: [],
    rerunConsistent: true,
    createdAt: new Date().toISOString(),
  });
  engine.replaceState(state);

  let persistCalls = 0;
  const response = await handleRuntimeRoutes({
    ...makeCtx({
      engine,
      method: "POST",
      path: "/api/assistant-loop/accept",
      body: { note: "test.accept-direction" },
    }),
    persistCurrentState: () => {
      persistCalls += 1;
    },
  });

  assert.ok(response);
  assert.equal(response.status, 200);
  assert.equal(persistCalls, 1);
  const payload = JSON.parse(response.body);
  assert.equal(payload.loop.acceptanceStatus, "accepted");
  assert.equal(payload.loop.status, "complete");
  assert.equal(payload.loop.statusLabel, "Accepted");
  assert.equal(engine.getState().well.acceptanceStatus, "accepted");
  assert.equal(engine.getState().well.acceptedCandidateId, "candidate-ready");
});

test("wish and goal routes persist state without mutating graph side effects", async () => {
  const prevCwd = process.cwd();
  const workdir = mkdtempSync(join(tmpdir(), "phonowell-route-"));
  const prevWorkspaceRoot = process.env.PHONOWELL_WORKSPACE_ROOT;
  process.chdir(workdir);
  try {
    process.env.PHONOWELL_WORKSPACE_ROOT = workdir;
    const moduleSuffix = `?wish-goal=${Date.now()}`;
    const { persistCurrentState, loadPersistedState, getActiveProject } = await import(`../orchestrator/store.js${moduleSuffix}`);
    const { engine } = await import(`../orchestrator/index.js${moduleSuffix}`);
    engine.replaceState(new PhonoWellEngine().getState());
    engine.bootstrapInitialState();
    const before = engine.getState();
    const project = getActiveProject();
    mkdirSync(project.workdir, { recursive: true });
    const stateFile = join(project.workdir, "state.json");

    let persistCalls = 0;
    const persist = () => {
      persistCalls += 1;
      writeFileSync(stateFile, JSON.stringify(engine.getState(), null, 2), "utf8");
    };

    await handleRuntimeRoutes({
      ...makeCtx({ engine, method: "POST", path: "/api/well/wish", body: { wish: "Ship stable offline gate", definitionOfDone: ["offline gate", "persist goal"], constraints: ["no fake ai"] } }),
      persistCurrentState: persist,
    });
    await handleRuntimeRoutes({
      ...makeCtx({ engine, method: "PUT", path: "/api/goal", body: { summary: "Stable offline gate and honest verify trace", status: "confirmed" } }),
      persistCurrentState: persist,
    });

    const after = engine.getState();
    const persistedRaw = JSON.parse(readFileSync(stateFile, "utf8"));

    assert.equal(persistCalls >= 2, true);
    assert.equal(after.well.wish, "Stable offline gate and honest verify trace");
    assert.equal(after.relations.length, before.relations.length);
    assert.equal(after.assetConversations.length, before.assetConversations.length);
    assert.equal(persistedRaw.well.wish, "Stable offline gate and honest verify trace");
  } finally {
    if (prevWorkspaceRoot === undefined) {
      delete process.env.PHONOWELL_WORKSPACE_ROOT;
    } else {
      process.env.PHONOWELL_WORKSPACE_ROOT = prevWorkspaceRoot;
    }
    process.chdir(prevCwd);
  }
});

test("core-gate offline command returns stable json", async () => {
  const { stdout } = await execFileAsync("pnpm", ["run", "core-gate:offline"], {
    cwd: process.cwd(),
    env: { ...process.env, PHONOWELL_DISABLE_CODEX_RUNTIME: "1" },
  });
  const parsed = JSON.parse(stdout.trim().split("\n").slice(-1)[0] ?? stdout.trim());
  assert.equal(parsed.mode, "offline");
  assert.equal(parsed.runtimeDisabled, true);
  assert.ok(parsed.result);
});

test("core-gate route is read-only", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  let persistCalls = 0;
  const before = engine.getState();

  const response = await handleReadRoutes({
    ...makeCtx({ engine, method: "GET", path: "/api/core-gate" }),
    persistCurrentState: () => {
      persistCalls += 1;
    },
  });

  assert.ok(response);
  const after = engine.getState();
  const payload = JSON.parse(response.body);
  assert.equal(persistCalls, 0);
  assert.deepEqual(after, before);
  assert.equal(typeof payload.gateResult, "string");
});

test("loop read route is read-only and exposes user-facing checkpoint data", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  const before = engine.getState();

  const response = await handleReadRoutes(makeCtx({
    engine,
    method: "GET",
    path: "/api/loop",
  }));

  assert.ok(response);
  const after = engine.getState();
  const payload = JSON.parse(response.body);
  assert.deepEqual(after, before);
  assert.equal(typeof payload.loop.statusLabel, "string");
  assert.equal(typeof payload.loop.primaryAction.label, "string");
  assert.equal(Array.isArray(payload.loop.reviewCheckpoints), true);
});

test("drop update rejects invalid position payload", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  const dropId = engine.getState().well.originDropId;

  const response = await handleAssetRoutes(makeCtx({
    engine,
    method: "PUT",
    path: `/api/drops/${dropId}`,
    body: { position: { x: "bad", y: 1 } },
  }));

  assert.ok(response);
  assert.equal(response.status, 400);
  assert.match(response.body, /invalid position\.x/);
});
