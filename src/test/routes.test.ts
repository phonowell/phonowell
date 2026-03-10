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
import { listAcceptanceItems } from "../orchestrator/acceptance-traceability.js";
import { handleAssetRoutes } from "../server/api/routes/assets.js";
import { handleReadRoutes } from "../server/api/routes/read.js";
import { handleRuntimeRoutes } from "../server/api/routes/runtime.js";
import { serveStatic } from "../server/static.js";
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

function makeRawReq(method: string, rawBody: string) {
  const req = new PassThrough() as PassThrough & { method?: string; url?: string };
  req.method = method;
  req.end(rawBody);
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
    url: new URL(`http://localhost:38888${input.path}`),
    engine: input.engine,
    persistCurrentState: () => {},
    debugMode: input.debugMode ?? false,
  };
}

function makeReadyVerifyReport(engine: PhonoWellEngine, createdAt = new Date().toISOString()) {
  const state = engine.getState();
  const coveredDropId = state.well.originDropId ?? state.drops[0]?.dropId ?? "drop-ready";
  const evidence = [{
    kind: "drop" as const,
    ref: coveredDropId,
    detail: "ready acceptance evidence",
    source: "manual-link" as const,
  }];
  return {
    pass: true,
    issues: [],
    suggestions: [],
    acceptanceCoverageDropIds: [coveredDropId],
    acceptanceItems: [{
      itemId: "accept-ready-item",
      title: "Ready acceptance evidence",
      source: "definition-of-done" as const,
      status: "covered" as const,
      coveredByDropIds: [coveredDropId],
      evidence,
      confidence: 0.96,
    }],
    changedDropCoverage: [{
      dropId: coveredDropId,
      acceptanceItemIds: ["accept-ready-item"],
      evidence,
    }],
    uncoveredAcceptanceItemIds: [],
    selfIterationEvidence: ["run-1:dry-run:pass", "run-2:generate:pass"],
    changedDropIds: [coveredDropId],
    rerunConsistent: true,
    createdAt,
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

test("state route redacts debug-only internals when debug api is disabled", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  await engine.runDeepOrganize("test.state-redaction");

  const response = await handleReadRoutes(makeCtx({
    engine,
    method: "GET",
    path: "/api/state",
    debugMode: false,
  }));

  assert.ok(response);
  const payload = JSON.parse(response.body);
  assert.deepEqual(payload.packetRecords, []);
  assert.deepEqual(payload.proposals, []);
  assert.deepEqual(payload.runLogs, []);
  assert.deepEqual(payload.assetConversations, []);
  assert.equal(payload.project.workdir, undefined);
  assert.equal(Array.isArray(payload.verifyReports), true);
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
  state.verifyReports.unshift(makeReadyVerifyReport(engine));
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

test("conversation route persists recorded messages", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  let persistCalls = 0;

  const response = await handleRuntimeRoutes({
    ...makeCtx({
      engine,
      method: "POST",
      path: "/api/conversations",
      body: { content: "Explain the next step" },
    }),
    persistCurrentState: () => {
      persistCalls += 1;
    },
  });

  assert.ok(response);
  assert.equal(response.status, 200);
  assert.equal(persistCalls, 1);
  const payload = JSON.parse(response.body);
  assert.equal(payload.userMessage.role, "user");
  assert.equal(payload.systemMessage.role, "system");
  assert.equal(engine.getState().assetConversations.length >= 2, true);
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

test("core-gate offline command evaluates current state instead of auto-converging a scenario", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "phonowell-core-gate-"));
  const { stdout } = await execFileAsync("pnpm", ["run", "core-gate:offline"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PHONOWELL_DISABLE_CODEX_RUNTIME: "1",
      PHONOWELL_WORKSPACE_ROOT: workspaceRoot,
    },
  });
  const parsed = JSON.parse(stdout.trim().split("\n").slice(-1)[0] ?? stdout.trim());
  assert.equal(parsed.mode, "offline");
  assert.notEqual(parsed.result.gateResult, "pass");
  assert.equal(parsed.result.summary.failCount >= 1 || parsed.result.summary.warnCount >= 1, true);
});

test("coverage command reports stable implementation coverage", async () => {
  const { stdout } = await execFileAsync("pnpm", ["run", "coverage"], {
    cwd: process.cwd(),
    env: { ...process.env, PHONOWELL_DISABLE_CODEX_RUNTIME: "1" },
  });
  const jsonStart = stdout.indexOf("{");
  assert.notEqual(jsonStart, -1);
  const parsed = JSON.parse(stdout.slice(jsonStart));
  assert.equal(parsed.summary.total, 19);
  assert.equal(parsed.summary.implemented, 19);
  assert.equal(parsed.summary.missing, 0);
});

test("coverage route matches the stable coverage contract", async () => {
  const engine = new PhonoWellEngine();
  const response = await handleReadRoutes(makeCtx({
    engine,
    method: "GET",
    path: "/api/coverage",
  }));

  assert.ok(response);
  const payload = JSON.parse(response.body);
  assert.equal(payload.summary.total, 19);
  assert.equal(payload.summary.implemented, 19);
  assert.equal(payload.summary.missing, 0);
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

test("hidden mutating maintenance routes are gated behind debug mode", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();

  const resetResponse = await handleReadRoutes(makeCtx({
    engine,
    method: "POST",
    path: "/api/reset-state",
    debugMode: false,
  }));
  const persistResponse = await handleReadRoutes(makeCtx({
    engine,
    method: "POST",
    path: "/api/state/persist",
    debugMode: false,
  }));
  const importResponse = await handleReadRoutes(makeCtx({
    engine,
    method: "POST",
    path: "/api/import-assets",
    debugMode: false,
  }));

  assert.ok(resetResponse);
  assert.ok(persistResponse);
  assert.ok(importResponse);
  assert.equal(resetResponse.status, 404);
  assert.equal(persistResponse.status, 404);
  assert.equal(importResponse.status, 404);
  assert.match(resetResponse.body, /debug api disabled/);
  assert.match(persistResponse.body, /debug api disabled/);
  assert.match(importResponse.body, /debug api disabled/);
});

test("public state route redacts debug-only internals", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  await engine.runDeepOrganize("test.public-state");

  const response = await handleReadRoutes(makeCtx({
    engine,
    method: "GET",
    path: "/api/state",
    debugMode: false,
  }));

  assert.ok(response);
  const payload = JSON.parse(response.body);
  assert.deepEqual(payload.packetRecords, []);
  assert.deepEqual(payload.proposals, []);
  assert.deepEqual(payload.runLogs, []);
  assert.deepEqual(payload.assetConversations, []);
  assert.equal(typeof payload.project?.workdir, "undefined");
  assert.ok(Array.isArray(payload.drops));
});

test("debug state route still exposes full internals", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.updateGoalOrigin({ status: "confirmed" });
  await engine.runDeepOrganize("test.debug-state");

  const response = await handleReadRoutes(makeCtx({
    engine,
    method: "GET",
    path: "/api/state",
    debugMode: true,
  }));

  assert.ok(response);
  const payload = JSON.parse(response.body);
  assert.ok(Array.isArray(payload.packetRecords));
  assert.ok(Array.isArray(payload.proposals));
  assert.equal(typeof payload.project?.workdir, "string");
});

test("runtime routes return 400 for malformed json bodies", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();

  const response = await handleRuntimeRoutes({
    ...makeCtx({
      engine,
      method: "POST",
      path: "/api/conversations",
    }),
    req: makeRawReq("POST", "{bad-json"),
  });

  assert.ok(response);
  assert.equal(response.status, 400);
});

test("manual runtime routes expose organize, dry-run, generate, and verify contracts", async () => {
  const engine = new PhonoWellEngine();
  engine.bootstrapInitialState();
  engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Manual stage material",
    summary: "Support one loop with verify evidence and acceptance mapping.",
    preserveOrphan: false,
  });
  engine.updateGoalOrigin({ status: "confirmed" });

  const organize = await handleRuntimeRoutes(makeCtx({
    engine,
    method: "POST",
    path: "/api/deep-organize",
    body: { trigger: "test.manual.organize" },
  }));
  assert.ok(organize);
  assert.equal(organize.status, 200);
  assert.ok(JSON.parse(organize.body).analyzePacket.packetId);

  const dryRun = await handleRuntimeRoutes(makeCtx({
    engine,
    method: "POST",
    path: "/api/dry-run",
  }));
  assert.ok(dryRun);
  assert.equal(dryRun.status, 200);
  assert.equal(typeof JSON.parse(dryRun.body).report.gateResult, "string");

  const state = engine.getState();
  const goalId = state.well.originDropId!;
  const firstItemId = listAcceptanceItems(state)[0]?.itemId;
  assert.ok(firstItemId);
  state.candidates.unshift({
    candidateId: "candidate-route-test",
    wellId: state.well.id,
    content: "candidate route test",
    coverageDropIds: state.drops.map((drop) => drop.dropId),
    createdAt: new Date().toISOString(),
  });
  engine.replaceState(state);
  await handleRuntimeRoutes(makeCtx({
    engine,
    method: "POST",
    path: "/api/acceptance-links",
    body: { dropId: goalId, itemIds: [firstItemId!], rationale: "route contract test" },
  }));

  const generate = await handleRuntimeRoutes(makeCtx({
    engine,
    method: "POST",
    path: "/api/generate",
  }));
  assert.ok(generate);
  assert.equal(generate.status, 200);
  assert.ok(JSON.parse(generate.body).candidate.candidateId);

  const verify = await handleRuntimeRoutes(makeCtx({
    engine,
    method: "POST",
    path: "/api/verify",
  }));
  assert.ok(verify);
  assert.equal(verify.status, 200);
  assert.equal(typeof JSON.parse(verify.body).verify.pass, "boolean");
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

test("static serving rejects paths outside the web root", () => {
  const parent = mkdtempSync(join(tmpdir(), "phonowell-static-"));
  const webRoot = join(parent, "webui");
  mkdirSync(webRoot, { recursive: true });
  writeFileSync(join(webRoot, "index.html"), "<h1>ok</h1>", "utf8");
  writeFileSync(join(parent, "webui-secret.txt"), "secret", "utf8");

  const safe = serveStatic(webRoot, "/index.html");
  const escaped = serveStatic(webRoot, "/../webui-secret.txt");

  assert.equal(safe.status, 200);
  assert.equal(escaped.status, 403);
});
