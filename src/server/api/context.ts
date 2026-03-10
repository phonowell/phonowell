import type { IncomingMessage } from "node:http";
import type { PhonoWellEngine } from "../../orchestrator/engine.js";
import type { ApiResponse } from "./http.js";

export interface ApiContext {
  req: IncomingMessage;
  method: string;
  url: URL;
  engine: PhonoWellEngine;
  persistCurrentState: () => void;
  debugMode: boolean;
}

export type RouteHandler = (ctx: ApiContext) => Promise<ApiResponse | undefined> | ApiResponse | undefined;
