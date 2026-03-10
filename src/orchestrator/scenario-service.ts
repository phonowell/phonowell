import { listAcceptanceItems } from "./acceptance-traceability.js";
import { PhonoWellEngine } from "./engine.js";

export async function runClosureScenario(
  engine: PhonoWellEngine,
  trigger = "scenario.closure",
): Promise<PhonoWellEngine> {
  engine.bootstrapInitialState();
  engine.ingestDrop({
    type: "note",
    source: "user",
    title: "Scenario material",
    summary: "Need one resumable assistant loop with auditable organize, dry-run, generate, verify, and acceptance evidence.",
    preserveOrphan: false,
  });
  engine.updateGoalOrigin({ status: "confirmed" });

  const state = engine.getState();
  const goalId = state.well.originDropId;
  if (goalId) {
    for (const item of listAcceptanceItems(state)) {
      engine.bindDropToAcceptanceItems(goalId, [item.itemId], `${trigger}.bind.${item.itemId}`);
    }
  }

  await engine.runDeepOrganize(`${trigger}.organize`);
  await engine.runCycle();
  engine.runDryRun();
  return engine;
}
