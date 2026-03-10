import type { IncomingMessage } from "node:http";

export type ApiResponse = { status: number; body: string; headers?: Record<string, string> };

export function json(data: unknown, status = 200): ApiResponse {
  return {
    status,
    body: JSON.stringify(data, null, 2),
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  };
}

export function badRequest(error: unknown): ApiResponse {
  return json({ error: String((error as Error).message) }, 400);
}

export function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}
