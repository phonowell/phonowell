import { getActiveProject, loadPersistedState, persistCurrentState } from "../orchestrator/store.js";
import { engine } from "../orchestrator/index.js";

export function hydrateRuntimeEngine(): { recoveredAutomationTaskCount: number } {
  const persisted = loadPersistedState();
  if (persisted) {
    engine.replaceState(persisted);
    engine.setProject(persisted.project);
  } else {
    engine.setProject(getActiveProject());
  }

  engine.bootstrapInitialState();
  const recoveredAutomationTaskCount = engine.processPendingAutomationTasks().length;
  persistCurrentState();

  return { recoveredAutomationTaskCount };
}
