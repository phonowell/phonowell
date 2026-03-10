import type { WellState } from "./types.js";

function ensure(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeSchemaVersion(raw: unknown): "1.0.0" | "1.1.0" {
  return raw === "1.1.0" ? "1.1.0" : "1.0.0";
}

function migrateStateV100ToV110(state: WellState): WellState {
  const mutable = state as unknown as Record<string, unknown>;
  mutable.schemaVersion = "1.1.0";
  return state;
}

const MIGRATIONS: Record<"1.0.0", (state: WellState) => WellState> = {
  "1.0.0": migrateStateV100ToV110,
};

export function migrateToLatest(state: WellState): WellState {
  let current = normalizeSchemaVersion(state.schemaVersion);
  let nextState = state;
  while (current !== "1.1.0") {
    const migrate = MIGRATIONS[current];
    ensure(Boolean(migrate), `unsupported schemaVersion migration path from ${current}`);
    nextState = migrate(nextState);
    current = normalizeSchemaVersion(nextState.schemaVersion);
  }
  (nextState as unknown as Record<string, unknown>).schemaVersion = "1.1.0";
  return nextState;
}
