import { readFileSync } from "node:fs";
import path from "node:path";
import type { ServerConfig } from "./types";

/** Default server configuration used when no config file is found */
const DEFAULT_CONFIG: ServerConfig = {
  port: 5050,
  host: "0.0.0.0",
  database_path: "arbiter.db",
  spec_workdir: ".spec-workdir",
  jq_binary_path: "jq",
  auth_required: false,
  external_tool_timeout_ms: 5000,
  websocket: { max_connections: 100, ping_interval_ms: 30000 },
};

/** Get the config file path from environment or default location */
function getConfigPath(): string {
  return process.env.ARBITER_CONFIG_PATH || path.join(process.cwd(), "config.json");
}

/** Build default config with environment overrides */
function buildDefaultConfig(): ServerConfig {
  return {
    ...DEFAULT_CONFIG,
    port: parseInt(process.env.PORT || String(DEFAULT_CONFIG.port), 10),
    spec_workdir: path.join(process.cwd(), DEFAULT_CONFIG.spec_workdir),
  };
}

/** Load server configuration from file or use defaults */
export function loadConfig(): ServerConfig {
  try {
    const raw = readFileSync(getConfigPath(), "utf-8");
    return JSON.parse(raw) as ServerConfig;
  } catch {
    return buildDefaultConfig();
  }
}
