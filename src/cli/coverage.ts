import { buildCoverageScenarioReport } from "../orchestrator/coverage.js";

const report = buildCoverageScenarioReport();

// eslint-disable-next-line no-console
console.log(JSON.stringify(report, null, 2));
