import { createProject, deleteProject, listProjects, loadPersistedState, switchProject } from "../../../orchestrator/store.js";
import { validateProjectCreateInput } from "../../../orchestrator/validator.js";
import type { ApiContext } from "../context.js";
import { badRequest, json, parseBody } from "../http.js";

function projectRouteStatus(error: unknown): number {
  const message = String((error as Error).message ?? error);
  if (message.includes("project not found") || message.includes("invalid project slug")) {
    return 404;
  }
  return 400;
}

export async function handleProjectRoutes(ctx: ApiContext) {
  const { method, url, engine, persistCurrentState } = ctx;

  if (method === "POST" && url.pathname === "/api/projects") {
    let body: ReturnType<typeof validateProjectCreateInput>;
    try {
      body = validateProjectCreateInput(await parseBody(ctx.req));
    } catch (error) {
      return badRequest(error);
    }
    const project = createProject(body.name ?? "Untitled Project");
    const persistedState = loadPersistedState();
    if (persistedState) {
      engine.replaceState(persistedState);
      engine.setProject(project);
      engine.processPendingAutomationTasks();
    } else {
      engine.setProject(project);
    }
    persistCurrentState();
    return json({ project, projects: listProjects() }, 201);
  }

  if (method === "PUT" && url.pathname.startsWith("/api/projects/")) {
    const slug = url.pathname.replace("/api/projects/", "");
    try {
      const project = switchProject(slug);
      engine.setProject(project);
      const persistedState = loadPersistedState();
      if (persistedState) {
        engine.replaceState(persistedState);
        engine.processPendingAutomationTasks();
      }
      persistCurrentState();
      return json({ project, projects: listProjects() });
    } catch (error) {
      return json({ error: String((error as Error).message) }, projectRouteStatus(error));
    }
  }

  if (method === "DELETE" && url.pathname.startsWith("/api/projects/")) {
    const slug = url.pathname.replace("/api/projects/", "");
    try {
      const result = deleteProject(slug);
      engine.setProject(result.activeProject);
      const persistedState = loadPersistedState();
      if (persistedState) {
        engine.replaceState(persistedState);
        engine.processPendingAutomationTasks();
      }
      persistCurrentState();
      return json({ ...result, projects: listProjects() });
    } catch (error) {
      return json({ error: String((error as Error).message) }, projectRouteStatus(error));
    }
  }

  return undefined;
}
