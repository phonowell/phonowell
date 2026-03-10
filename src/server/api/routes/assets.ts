import type { AssetType } from "../../../orchestrator/types.js";
import {
  validateCreateDropInput,
  validateQuestionsInput,
  validateRelationInput,
  validateUpdateDropInput,
} from "../../../orchestrator/validator.js";
import type { ApiContext } from "../context.js";
import { badRequest, json, parseBody } from "../http.js";

export function summarizeAssetInput(input: {
  text?: string;
  fileName?: string;
  fileContent?: string;
  title?: string;
  summary?: string;
  content?: string;
}): { title: string; summary: string; content: string; type: AssetType } {
  if (typeof input.fileContent === "string" && input.fileContent.trim()) {
    const content = input.fileContent.trim();
    const title = (input.fileName?.trim() || "Imported File").slice(0, 48);
    return {
      title,
      summary: content.slice(0, 280),
      content,
      type: "doc",
    };
  }
  if (typeof input.text === "string" && input.text.trim()) {
    const content = input.text.trim();
    return {
      title: content.slice(0, 48),
      summary: content,
      content,
      type: "note",
    };
  }
  return {
    title: (input.title?.trim() || "Untitled Asset").slice(0, 48),
    summary: input.summary?.trim() || "",
    content: input.content?.trim?.() || input.summary?.trim() || "",
    type: "note",
  };
}

export async function handleAssetRoutes(ctx: ApiContext) {
  const { method, url, engine, persistCurrentState } = ctx;

  if (method === "POST" && url.pathname === "/api/drops") {
    let body: ReturnType<typeof validateCreateDropInput>;
    try {
      body = validateCreateDropInput(await parseBody(ctx.req));
    } catch (error) {
      return badRequest(error);
    }
    const normalized = summarizeAssetInput(body);
    const skipAutoFlow = body.skipAutoFlow === true;
    const drop = engine.ingestDrop({
      type: body.type ?? normalized.type,
      source: body.source ?? "user",
      title: body.title?.trim() || normalized.title,
      summary: body.summary?.trim() || normalized.summary,
      content: body.content ?? normalized.content,
      priority: body.priority ?? "p2",
      scope: body.scope,
      domain: body.domain ?? "delivery",
      owner: body.owner ?? "user",
      parentDropId: body.parentDropId,
      x: body.x,
      y: body.y,
      skipAutoFlow,
      preserveOrphan: skipAutoFlow,
    });
    const automation = skipAutoFlow ? null : engine.schedulePostIngestAutomation(drop.dropId, "api.drop");
    persistCurrentState();
    queueMicrotask(() => {
      if (!skipAutoFlow) {
        engine.processPendingAutomationTasks();
        persistCurrentState();
      }
    });
    return json({ drop, automation, report: null });
  }

  if (method === "PUT" && url.pathname.startsWith("/api/drops/")) {
    const dropId = url.pathname.replace("/api/drops/", "");
    let body: ReturnType<typeof validateUpdateDropInput>;
    try {
      body = validateUpdateDropInput(await parseBody(ctx.req));
    } catch (error) {
      return badRequest(error);
    }
    try {
      const drop = engine.updateDrop(dropId, {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.summary === "string" ? { summary: body.summary } : {}),
        ...(body.position ? { position: body.position } : {}),
        skipAutoFlow: body.skipAutoFlow ?? Boolean(body.position),
      });
      persistCurrentState();
      return json({ drop, report: null });
    } catch (error) {
      return badRequest(error);
    }
  }

  if (method === "POST" && url.pathname === "/api/relations") {
    let body: ReturnType<typeof validateRelationInput>;
    try {
      body = validateRelationInput(await parseBody(ctx.req));
    } catch (error) {
      return badRequest(error);
    }
    const relation = engine.connectDrops(body.fromDropId, body.toDropId, body.relationType ?? "references");
    persistCurrentState();
    return json({ relation, report: null });
  }

  if (method === "DELETE" && url.pathname.startsWith("/api/relations/")) {
    const relationId = url.pathname.replace("/api/relations/", "");
    const removed = engine.removeRelation(relationId);
    persistCurrentState();
    return json({ removed, report: null });
  }

  if (method === "POST" && url.pathname === "/api/unresolved-questions") {
    let body: ReturnType<typeof validateQuestionsInput>;
    try {
      body = validateQuestionsInput(await parseBody(ctx.req));
    } catch (error) {
      return badRequest(error);
    }
    const questions = engine.setUnresolvedQuestions(body.questions ?? []);
    persistCurrentState();
    return json({ questions, report: null });
  }

  return undefined;
}
