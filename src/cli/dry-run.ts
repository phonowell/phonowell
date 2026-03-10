import { engine } from "../orchestrator/index.js";

engine.ensureGoalOriginDraft();
engine.updateGoalOrigin({ status: "confirmed" });

const report = engine.runDryRun();
const cycle = await engine.runCycle();

// eslint-disable-next-line no-console
console.log(JSON.stringify({ gateResult: report.gateResult, report, cycle }, null, 2));
