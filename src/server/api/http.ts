import type { IncomingMessage } from "node:http";

export type ApiResponse = { status: number; body: string; headers?: Record<string, string> };
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function resolveMaxBodyBytes(): number {
  const configured = Number(process.env.PHONOWELL_MAX_BODY_BYTES);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_BODY_BYTES;
}

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
  const status = typeof (error as { status?: unknown })?.status === "number"
    ? Number((error as { status: number }).status)
    : 400;
  return json({ error: String((error as Error).message) }, status);
}

export function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const maxBodyBytes = resolveMaxBodyBytes();
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;
    req.on("data", (chunk) => {
      if (settled) {
        return;
      }
      const buffer = Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maxBodyBytes) {
        settled = true;
        reject(new ApiError(413, `request body too large: exceeds ${maxBodyBytes} bytes`));
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      if (settled) {
        return;
      }
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
    req.on("error", (error) => {
      if (settled) {
        return;
      }
      reject(error);
    });
  });
}
