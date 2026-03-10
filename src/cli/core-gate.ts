import { engine } from "../orchestrator/index.js";
import { runCoreGateScenario } from "../orchestrator/core-gate.js";

const result = await runCoreGateScenario(engine);

// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));
