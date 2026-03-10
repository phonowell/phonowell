import { engine } from "../orchestrator/index.js";
import { loadAssetCatalog } from "../orchestrator/asset-catalog.js";
import { importCatalogIntoState } from "../orchestrator/importer.js";
import { persistCurrentState } from "../orchestrator/store.js";

const imported = importCatalogIntoState(engine.getState(), loadAssetCatalog());
engine.replaceState(imported.state);
persistCurrentState();

// eslint-disable-next-line no-console
console.log(JSON.stringify(imported.result, null, 2));
