import {
  validateAutoFlowInput,
  validateAssistantLoopInput,
  validateAcceptDirectionInput,
  validateGoalInput,
  validatePacketStage,
  validateWishInput,
} from "../../../orchestrator/validator.js";
import type { ApiContext } from "../context.js";
import { badRequest, json, parseBody } from "../http.js";

export async function handleRuntimeRoutes(ctx: ApiContext) {
  const { method, url, engine, persistCurrentState } = ctx;

  if (method === "POST" && url.pathname === "/api/well/wish") {
    let body: ReturnType<typeof validateWishInput>;
    try {
      body = validateWishInput(await parseBody(ctx.req));
    } catch (error) {
      return badRequest(error);
    }
    const updated = engine.setWish({
      wish: body.wish ?? "Build phonowell artifact",
      definitionOfDone: Array.isArray(body.definitionOfDone) ? body.definitionOfDone : [],
      constraints: Array.isArray(body.constraints) ? body.constraints : [],
    });
    persistCurrentState();
    return json({ well: updated });
  }
  if (method === "POST" && url.pathname === "/api/goal/draft") {
    const goal = engine.ensureGoalOriginDraft();
    persistCurrentState();
    return json({ goal, report: null });
  }
  if (method === "PUT" && url.pathname === "/api/goal") {
    let body: ReturnType<typeof validateGoalInput>;
    try {
      body = validateGoalInput(await parseBody(ctx.req));
    } catch (error) {
      return badRequest(error);
    }
    const goal = engine.updateGoalOrigin(body);
    persistCurrentState();
    return json({ goal, report: null });
  }
  if (method === "POST" && url.pathname === "/api/acceptance-links") {
    let body: Partial<{ dropId: string; itemIds: string[]; rationale: string }>;
    try {
      body = (await parseBody(ctx.req)) as Partial<{ dropId: string; itemIds: string[]; rationale: string }>;
    } catch (error) {
      return badRequest(error);
    }
    try {
      const drop = engine.bindDropToAcceptanceItems(body.dropId ?? "", body.itemIds ?? [], body.rationale ?? "manual api bind");
      persistCurrentState();
      return json({ drop });
    } catch (error) {
      return json({ error: String((error as Error).message) }, 400);
    }
  }
  if (method === "POST" && url.pathname === "/api/conversations") {
    let body: Partial<{ content: string; dropId: string; scope: "global" | "asset" }>;
    try {
      body = (await parseBody(ctx.req)) as Partial<{ content: string; dropId: string; scope: "global" | "asset" }>;
    } catch (error) {
      return badRequest(error);
    }
    try {
      const result = await engine.runConversation({
        content: body.content ?? "",
        dropId: body.dropId,
        scope: body.scope ?? (body.dropId ? "asset" : "global"),
      });
      persistCurrentState();
      return json(result);
    } catch (error) {
      return json({ error: String((error as Error).message) }, 400);
    }
  }
  if (method === "POST" && url.pathname === "/api/assistant-loop") {
    let body: ReturnType<typeof validateAssistantLoopInput>;
    try {
      body = validateAssistantLoopInput(await parseBody(ctx.req));
    } catch (error) {
      return badRequest(error);
    }
    const loop = await engine.runAssistantLoop({ trigger: body.trigger ?? "api.assistant-loop" });
    persistCurrentState();
    return json({ loop }, loop.status === "failed" ? 409 : 200);
  }
  if (method === "POST" && url.pathname === "/api/assistant-loop/accept") {
    let body: ReturnType<typeof validateAcceptDirectionInput>;
    try {
      body = validateAcceptDirectionInput(await parseBody(ctx.req));
    } catch (error) {
      return badRequest(error);
    }
    try {
      const loop = engine.acceptCurrentDirection(body.note);
      persistCurrentState();
      return json({ loop });
    } catch (error) {
      return json({ error: String((error as Error).message) }, 409);
    }
  }
  if (method === "POST" && url.pathname === "/api/auto-flow") {
    if (!ctx.debugMode) {
      return json({ error: "debug api disabled" }, 404);
    }
    let body: ReturnType<typeof validateAutoFlowInput>;
    try {
      body = validateAutoFlowInput(await parseBody(ctx.req));
    } catch (error) {
      return badRequest(error);
    }
    return json({ report: engine.runAutoFlow(body.trigger ?? "manual.auto-flow") });
  }
  if (method === "POST" && url.pathname === "/api/deep-organize") {
    let body: Partial<{ trigger: string }>;
    try {
      body = (await parseBody(ctx.req)) as Partial<{ trigger: string }>;
    } catch (error) {
      return badRequest(error);
    }
    try {
      const result = await engine.runDeepOrganize(body.trigger ?? "manual.deep-organize");
      persistCurrentState();
      return json(result);
    } catch (error) {
      return json({ error: String((error as Error).message) }, 400);
    }
  }
  if (method === "POST" && url.pathname === "/api/dry-run") {
    const report = engine.runDryRun();
    persistCurrentState();
    return json({ report });
  }
  if (method === "POST" && url.pathname.startsWith("/api/packets/")) {
    if (!ctx.debugMode) {
      return json({ error: "debug api disabled" }, 404);
    }
    let stage: ReturnType<typeof validatePacketStage>;
    try {
      stage = validatePacketStage(url.pathname.replace("/api/packets/", ""));
    } catch (error) {
      return badRequest(error);
    }
    const packet = await engine.runPacketStage(stage);
    persistCurrentState();
    return json({ packet });
  }
  if (method === "POST" && url.pathname.startsWith("/api/proposals/") && url.pathname.endsWith("/apply")) {
    if (!ctx.debugMode) {
      return json({ error: "debug api disabled" }, 404);
    }
    const proposalId = url.pathname.replace("/api/proposals/", "").replace("/apply", "");
    const proposal = engine.applyProposalById(proposalId);
    persistCurrentState();
    return json({ proposal });
  }
  if (method === "POST" && url.pathname.startsWith("/api/proposals/") && url.pathname.endsWith("/reject")) {
    if (!ctx.debugMode) {
      return json({ error: "debug api disabled" }, 404);
    }
    const proposalId = url.pathname.replace("/api/proposals/", "").replace("/reject", "");
    const proposal = engine.rejectProposalById(proposalId);
    persistCurrentState();
    return json({ proposal });
  }
  if (method === "POST" && url.pathname === "/api/generate") {
    try {
      const candidate = await engine.generateArtifact();
      persistCurrentState();
      return json({ candidate });
    } catch (error) {
      return json({ error: String((error as Error).message) }, 400);
    }
  }
  if (method === "POST" && url.pathname === "/api/verify") {
    try {
      const verify = await engine.verifyLatest();
      persistCurrentState();
      return json({ verify });
    } catch (error) {
      return json({ error: String((error as Error).message) }, 400);
    }
  }
  if (method === "POST" && url.pathname === "/api/cycle") {
    if (!ctx.debugMode) {
      return json({ error: "debug api disabled" }, 404);
    }
    const result = await engine.runCycle();
    persistCurrentState();
    return json(result, result.error ? 409 : 200);
  }

  return undefined;
}
