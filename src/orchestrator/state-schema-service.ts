import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import type { CatalogAsset, SchemaValidationIssue, SchemaValidationReport, WellState } from "./types.js";
import { resolveFromAppRoot } from "../runtime-paths.js";

const ASSET_SCHEMA_FILE = resolveFromAppRoot("schemas", "phonowell-asset.schema.json");
const STATE_SCHEMA_FILE = resolveFromAppRoot("schemas", "phonowell-state.schema.json");
const DROP_SCHEMA_FILE = resolveFromAppRoot("schemas", "drop.schema.json");
const RELATION_SCHEMA_FILE = resolveFromAppRoot("schemas", "relation.schema.json");
const CANDIDATE_SCHEMA_FILE = resolveFromAppRoot("schemas", "candidate.schema.json");
const PACKET_RECORD_SCHEMA_FILE = resolveFromAppRoot("schemas", "packet-record.schema.json");
const VERIFY_REPORT_SCHEMA_FILE = resolveFromAppRoot("schemas", "verify-report.schema.json");

const SCHEMA_FILES = [
  ASSET_SCHEMA_FILE,
  DROP_SCHEMA_FILE,
  RELATION_SCHEMA_FILE,
  CANDIDATE_SCHEMA_FILE,
  PACKET_RECORD_SCHEMA_FILE,
  VERIFY_REPORT_SCHEMA_FILE,
  STATE_SCHEMA_FILE,
] as const;

const SCHEMA_DOCS = SCHEMA_FILES.map((file) => JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>);
const ajv = new Ajv2020.default({ allErrors: true, strict: false });
addFormats.default(ajv);
for (const schema of SCHEMA_DOCS) {
  ajv.addSchema(schema);
}

const assetValidator = ajv.getSchema("https://phonowell.dev/schemas/phonowell-asset.schema.json");
const stateValidator = ajv.getSchema("https://phonowell.dev/schemas/phonowell-state.schema.json");

function ensure(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function collectSchemaIssues(schemaId: string, errors: typeof assetValidator extends (...args: never[]) => unknown ? never : unknown): SchemaValidationIssue[] {
  const ajvErrors = (errors as Array<{ instancePath?: string; message?: string }> | null | undefined) ?? [];
  return ajvErrors.map((error) => ({
    schemaId,
    instancePath: error.instancePath || "/",
    message: error.message || "schema validation failed",
  }));
}

function assertSchemaValidatorExists<T>(validator: T | undefined, schemaId: string): T {
  ensure(Boolean(validator), `schema validator missing for ${schemaId}`);
  return validator as T;
}

export function getSchemaManifest(): {
  assetSchemaId: string;
  stateSchemaId: string;
  entitySchemaIds: string[];
} {
  const asset = JSON.parse(readFileSync(ASSET_SCHEMA_FILE, "utf8")) as { $id?: string };
  const state = JSON.parse(readFileSync(STATE_SCHEMA_FILE, "utf8")) as { $id?: string };
  return {
    assetSchemaId: asset.$id ?? ASSET_SCHEMA_FILE,
    stateSchemaId: state.$id ?? STATE_SCHEMA_FILE,
    entitySchemaIds: [
      "https://phonowell.dev/schemas/drop.schema.json",
      "https://phonowell.dev/schemas/relation.schema.json",
      "https://phonowell.dev/schemas/candidate.schema.json",
      "https://phonowell.dev/schemas/packet-record.schema.json",
      "https://phonowell.dev/schemas/verify-report.schema.json",
    ],
  };
}

export function getSchemaValidationReport(state: WellState, catalog: CatalogAsset[]): SchemaValidationReport {
  const validatedSchemas: string[] = [];
  const issues: SchemaValidationIssue[] = [];

  const ensuredAssetValidator = assertSchemaValidatorExists(assetValidator, "https://phonowell.dev/schemas/phonowell-asset.schema.json");
  const ensuredStateValidator = assertSchemaValidatorExists(stateValidator, "https://phonowell.dev/schemas/phonowell-state.schema.json");

  for (const asset of catalog) {
    const pass = ensuredAssetValidator(asset);
    if (!pass) {
      issues.push(...collectSchemaIssues("https://phonowell.dev/schemas/phonowell-asset.schema.json", ensuredAssetValidator.errors));
    }
  }
  validatedSchemas.push("https://phonowell.dev/schemas/phonowell-asset.schema.json");

  const statePass = ensuredStateValidator(state);
  if (!statePass) {
    issues.push(...collectSchemaIssues("https://phonowell.dev/schemas/phonowell-state.schema.json", ensuredStateValidator.errors));
  }
  validatedSchemas.push(
    "https://phonowell.dev/schemas/phonowell-state.schema.json",
    "https://phonowell.dev/schemas/drop.schema.json",
    "https://phonowell.dev/schemas/relation.schema.json",
    "https://phonowell.dev/schemas/candidate.schema.json",
    "https://phonowell.dev/schemas/packet-record.schema.json",
    "https://phonowell.dev/schemas/verify-report.schema.json",
  );

  return {
    pass: issues.length === 0,
    schemaVersion: state.schemaVersion,
    validatedSchemas,
    issueCount: issues.length,
    issues,
  };
}

export function validateCatalogAssetSchema(asset: CatalogAsset): void {
  const ensuredAssetValidator = assertSchemaValidatorExists(assetValidator, "https://phonowell.dev/schemas/phonowell-asset.schema.json");
  ensure(Boolean(ensuredAssetValidator(asset)), `catalog asset schema validation failed: ${asset.dropId}`);
}
