import { engine } from "../orchestrator/index.js";
import { evaluateCoreGate } from "../orchestrator/core-gate.js";
import { getActiveProject, loadPersistedState } from "../orchestrator/store.js";

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
console.log(JSON.stringify(result, null, 2));
