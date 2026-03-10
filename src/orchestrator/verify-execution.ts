import type { VerifyRouteExecution, VerifyCycleRecord } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildRouteFailure(route: VerifyCycleRecord["verifyRoute"], error: unknown, actions: string[], evidence: string[]): VerifyRouteExecution {
  return {
    route,
    executed: false,
    status: "fail",
    actions,
    evidence: [...evidence, String((error as Error).message)],
    createdAt: nowIso(),
  };
}
