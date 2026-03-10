process.env.PHONOWELL_DISABLE_CODEX_RUNTIME = "1";

const { engine } = await import("../orchestrator/index.js");
const { runCoreGateScenario } = await import("../orchestrator/core-gate.js");

const result = await runCoreGateScenario(engine);

// eslint-disable-next-line no-console
console.log(JSON.stringify({
  mode: "offline",
  runtimeDisabled: true,
  result,
}));
