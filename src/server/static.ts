import { readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import type { ApiResponse } from "./api/http.js";

function getMimeType(file: string): string {
  switch (extname(file)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".mjs":
      return "text/javascript; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}

function isWithinRoot(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function serveStatic(webRoot: string, pathname: string): ApiResponse {
  const file = pathname === "/" ? "/index.html" : pathname;
  const absPath = resolve(webRoot, `.${file}`);
  if (!isWithinRoot(webRoot, absPath)) {
    return { status: 403, body: "Forbidden", headers: { "content-type": "text/plain; charset=utf-8" } };
  }

  try {
    const stat = statSync(absPath);
    if (!stat.isFile()) {
      return { status: 404, body: "Not Found", headers: { "content-type": "text/plain; charset=utf-8" } };
    }
    return {
      status: 200,
      body: readFileSync(absPath, "utf8"),
      headers: { "content-type": getMimeType(absPath) },
    };
  } catch {
    return { status: 404, body: "Not Found", headers: { "content-type": "text/plain; charset=utf-8" } };
  }
}
