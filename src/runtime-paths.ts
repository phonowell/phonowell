import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function getAppRoot(): string {
  return resolve(process.env.PHONOWELL_APP_ROOT ?? DEFAULT_APP_ROOT);
}

export function getWorkspaceRoot(): string {
  return resolve(process.env.PHONOWELL_WORKSPACE_ROOT ?? getAppRoot());
}

export function resolveFromAppRoot(...segments: string[]): string {
  return resolve(getAppRoot(), ...segments);
}

export function resolveFromWorkspaceRoot(...segments: string[]): string {
  return resolve(getWorkspaceRoot(), ...segments);
}
