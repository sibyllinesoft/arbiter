import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import yaml from "yaml";
import { z } from "zod";
import type { CLIConfig } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default CLI configuration
 * Updated to match Arbiter specification constraints
 */
export const DEFAULT_CONFIG: CLIConfig = {
  apiUrl: "http://localhost:5050", // Standardized to match server default
  timeout: 750, // Enforce spec maximum (≤750ms)
  format: "table",
  color: true,
  projectDir: process.cwd(),
};

/**
 * Common ports to try for server auto-discovery
 * Listed in order of preference
 */
export const COMMON_PORTS = [5050, 3000, 4000, 8080] as const;

/**
 * Configuration file schema for validation
 * Enforces Arbiter specification constraints
 */
const configSchema = z.object({
  apiUrl: z.string().url().optional(),
  timeout: z.number().min(100).max(750).optional(), // Enforce spec maximum (≤750ms)
  format: z.enum(["table", "json", "yaml"]).optional(),
  color: z.boolean().optional(),
  projectDir: z.string().optional(),
});

/**
 * Possible configuration file names
 */
const CONFIG_FILES = [
  ".arbiter.json",
  ".arbiter.yaml",
  ".arbiter.yml",
  "arbiter.json",
  "arbiter.yaml",
  "arbiter.yml",
];

/**
 * Load CLI configuration from file or use defaults
 */
export async function loadConfig(configPath?: string): Promise<CLIConfig> {
  const baseConfig = { ...DEFAULT_CONFIG };

  if (configPath) {
    return await loadSpecificConfigFile(configPath, baseConfig);
  }

  return await searchForConfigFile(baseConfig);
}

/**
 * Load a specific configuration file
 */
async function loadSpecificConfigFile(configPath: string, baseConfig: CLIConfig): Promise<CLIConfig> {
  if (!(await fs.pathExists(configPath))) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const userConfig = await loadConfigFile(configPath);
  return { ...baseConfig, ...userConfig };
}

/**
 * Search for configuration files up the directory tree
 */
async function searchForConfigFile(baseConfig: CLIConfig): Promise<CLIConfig> {
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const foundConfig = await findConfigInDirectory(currentDir);
    if (foundConfig) {
      return { ...baseConfig, ...foundConfig };
    }
    currentDir = path.dirname(currentDir);
  }

  return baseConfig;
}

/**
 * Find configuration file in a specific directory
 */
async function findConfigInDirectory(directory: string): Promise<Partial<CLIConfig> | null> {
  for (const fileName of CONFIG_FILES) {
    const configFile = path.join(directory, fileName);
    if (await fs.pathExists(configFile)) {
      return await loadConfigFile(configFile);
    }
  }
  return null;
}

/**
 * Load and parse a configuration file
 */
async function loadConfigFile(filePath: string): Promise<Partial<CLIConfig>> {
  const content = await fs.readFile(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();

  let parsed: unknown;

  if (ext === ".json") {
    parsed = JSON.parse(content);
  } else if (ext === ".yaml" || ext === ".yml") {
    parsed = yaml.parse(content);
  } else {
    throw new Error(`Unsupported configuration file format: ${ext}`);
  }

  // Validate configuration
  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Save configuration to file
 */
export async function saveConfig(config: Partial<CLIConfig>, filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();
  let content: string;

  if (ext === ".json") {
    content = JSON.stringify(config, null, 2);
  } else if (ext === ".yaml" || ext === ".yml") {
    content = yaml.stringify(config);
  } else {
    throw new Error(`Unsupported configuration file format: ${ext}`);
  }

  await fs.writeFile(filePath, content, "utf-8");
}

/**
 * Get default configuration file path
 */
export function getDefaultConfigPath(): string {
  return path.join(process.cwd(), ".arbiter.json");
}
