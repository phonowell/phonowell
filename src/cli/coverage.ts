import { engine } from "../orchestrator/index.js";
import { buildCoverageReport } from "../orchestrator/coverage.js";

const report = buildCoverageReport(engine.getCatalog(), engine.getState());

// eslint-disable-next-line no-console
console.log(JSON.stringify(report, null, 2));
