import { createServer } from "node:http";
import { engine } from "./orchestrator/index.js";
import { persistCurrentState } from "./orchestrator/store.js";
import { handleAssetRoutes } from "./server/api/routes/assets.js";
import { handleProjectRoutes } from "./server/api/routes/projects.js";
import { handleReadRoutes } from "./server/api/routes/read.js";
import { handleRuntimeRoutes } from "./server/api/routes/runtime.js";
import { json } from "./server/api/http.js";
import type { ApiResponse } from "./server/api/http.js";
import { hydrateRuntimeEngine } from "./server/bootstrap.js";
import { resolveFromAppRoot } from "./runtime-paths.js";
import { serveStatic } from "./server/static.js";

const PORT = Number(process.env.PORT ?? 38888);
const MAX_PORT_SEARCH = Number(process.env.PHONOWELL_PORT_SEARCH_LIMIT ?? 10);
const DEBUG_API_ENABLED = process.env.PHONOWELL_ENABLE_DEBUG_API === "1";
const WEB_ROOT = resolveFromAppRoot("webui");
hydrateRuntimeEngine();

function send(
  res: import("node:http").ServerResponse,
  payload: ApiResponse,
): void {
  res.writeHead(payload.status, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type",
    ...(payload.headers ?? {}),
  });
  res.end(payload.body);
}

async function handleApi(
  req: import("node:http").IncomingMessage,
) : Promise<ApiResponse> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const ctx = { req, method, url, engine, persistCurrentState, debugMode: DEBUG_API_ENABLED };
  return (
    await handleReadRoutes(ctx)
    ?? await handleProjectRoutes(ctx)
    ?? await handleAssetRoutes(ctx)
    ?? await handleRuntimeRoutes(ctx)
    ?? json({ error: "Not Found" }, 404)
  );
}

const server = createServer(async (req, res) => {
  if ((req.method ?? "GET") === "OPTIONS") {
    send(res, { status: 204, body: "", headers: {} });
    return;
  }

  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    if (url.pathname.startsWith("/api/")) {
      const payload = await handleApi(req);
      send(res, payload);
      return;
    }
    const payload = serveStatic(WEB_ROOT, url.pathname);
    send(res, payload);
  } catch (error) {
    send(res, json({ error: String((error as Error).message) }, 500));
  }
});

function startListening(port: number, attemptsRemaining = MAX_PORT_SEARCH): void {
  const onError = (error: NodeJS.ErrnoException) => {
    server.off("error", onError);
    if (error.code === "EADDRINUSE" && attemptsRemaining > 0) {
      const nextPort = port + 1;
      // eslint-disable-next-line no-console
      console.warn(`port ${port} is in use; retrying on ${nextPort}`);
      startListening(nextPort, attemptsRemaining - 1);
      return;
    }
    throw error;
  };

  server.once("error", onError);
  server.listen(port, () => {
    server.off("error", onError);
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    // eslint-disable-next-line no-console
    console.log(`phonowell server running at http://localhost:${actualPort}`);
  });
}

startListening(PORT);
