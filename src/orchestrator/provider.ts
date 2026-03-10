import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ProviderSettings {
  provider: string;
  apiKey?: string;
  baseUrl: string;
  wireApi: string;
  model: string;
  requiresAuth?: boolean;
}

interface ProviderConfig {
  provider: string;
  apiKey?: string;
  envKey?: string;
  baseUrl?: string;
  wireApi?: string;
  requiresAuth?: boolean;
}

function readFileIfExists(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

function parseTomlStringValue(source: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`^\\s*${escaped}\\s*=\\s*"([^"]*)"\\s*$`, "m"));
  return match?.[1]?.trim() || undefined;
}

function readActiveProviderConfig(source: string): ProviderConfig | undefined {
  const provider = parseTomlStringValue(source, "model_provider");
  if (!provider) {
    return undefined;
  }

  const section = source.match(new RegExp(`\\[model_providers\\.${provider.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]([\\s\\S]*?)(?:\\n\\[|$)`));
  const body = section?.[1] ?? "";

  return {
    provider,
    apiKey: parseTomlStringValue(body, "api_key"),
    envKey: parseTomlStringValue(body, "env_key") ?? parseTomlStringValue(body, "api_key_env"),
    baseUrl: parseTomlStringValue(body, "base_url"),
    wireApi: parseTomlStringValue(body, "wire_api"),
    requiresAuth: parseTomlStringValue(body, "requires_openai_auth") === "false" ? false : undefined,
  };
}

function readCodexAuthKey(home: string): string | undefined {
  const raw = readFileIfExists(join(home, ".codex", "auth.json"));
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as { OPENAI_API_KEY?: string };
    return parsed.OPENAI_API_KEY;
  } catch {
    return undefined;
  }
}

export function loadProviderSettings(): ProviderSettings {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
  const configRaw = readFileIfExists(join(home, ".codex", "config.toml")) ?? "";
  const active = readActiveProviderConfig(configRaw);
  const configuredModel = parseTomlStringValue(configRaw, "model");

  const apiKey = active?.apiKey
    ?? (active?.envKey ? process.env[active.envKey] : undefined)
    ?? process.env.OPENAI_API_KEY
    ?? readCodexAuthKey(home);

  return {
    provider: active?.provider ?? "codex-sdk",
    apiKey,
    baseUrl: active?.baseUrl ?? process.env.OPENAI_BASE_URL ?? "codex-managed",
    wireApi: active?.wireApi ?? process.env.OPENAI_WIRE_API ?? "codex-sdk",
    model: process.env.OPENAI_MODEL ?? configuredModel ?? "codex-default",
    requiresAuth: process.env.OPENAI_REQUIRES_AUTH === "false" ? false : active?.requiresAuth ?? false,
  };
}
