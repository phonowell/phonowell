process.env.PHONOWELL_DISABLE_CODEX_RUNTIME = "1";

const { engine } = await import("../orchestrator/index.js");
const { evaluateCoreGate } = await import("../orchestrator/core-gate.js");
const { getActiveProject, loadPersistedState } = await import("../orchestrator/store.js");

const persisted = loadPersistedState();
if (persisted) {
  engine.replaceState(persisted);
  engine.setProject(persisted.project);
} else {
  engine.setProject(getActiveProject());
  engine.bootstrapInitialState();
}
const result = evaluateCoreGate(engine.getState(), engine.getCatalog());

// eslint-disable-next-line no-console
console.log(JSON.stringify({
  mode: "offline",
  runtimeDisabled: true,
  result,
}));
