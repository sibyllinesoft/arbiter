import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { safeFileOperation } from "@/constraints/index.js";
import type { CLIConfig, DefaultConfig, ProjectStructureConfig } from "@/types.js";
import { findGitRoot } from "@/utils/io/git-detection.js";
import { DEFAULT_UI_OPTION_CATALOG } from "@arbiter/specification";
import chalk from "chalk";
import fs from "fs-extra";
import yaml from "yaml";
import { configSchema } from "./config-schemas.js";
import {
  cloneConfig,
  cloneGeneratorConfig,
  isTruthyEnvFlag,
  mergeGeneratorConfig,
  mergeOptionCatalog,
  mergeOptionGenerators,
} from "./config-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate a project ID based on current directory and git repository
 */
function generateProjectId(): string {
  const cwd = process.cwd();
  const projectName = path.basename(cwd);

  // Try to read git config for a more stable identifier
  try {
    const gitConfigPath = path.join(cwd, ".git", "config");
    if (fs.existsSync(gitConfigPath)) {
      const gitConfig = fs.readFileSync(gitConfigPath, "utf-8");
      const match = gitConfig.match(/url = .*[:/]([^/]+\/[^/]+?)(?:\.git)?$/m);
      if (match) {
        // Use repo owner/name as project ID (e.g., "owner-repo")
        return match[1].replace("/", "-").toLowerCase();
      }
    }
  } catch {
    // Ignore git config read errors
  }

  // Fallback to directory name with a hash for uniqueness
  const hash = crypto.createHash("md5").update(cwd).digest("hex").substring(0, 8);
  return `${projectName.toLowerCase()}-${hash}`;
}

export const DEFAULT_PROJECT_STRUCTURE: ProjectStructureConfig = {
  clientsDirectory: "clients",
  servicesDirectory: "services",
  packagesDirectory: "packages",
  toolsDirectory: "tools",
  docsDirectory: "docs",
  testsDirectory: "tests",
  infraDirectory: "infra",
  packageRelative: {
    docsDirectory: false,
    testsDirectory: false,
    infraDirectory: false,
  },
};

/**
 * Default configuration for hierarchical artifact organization.
 * Replaces the default clients/, services/, tools/ directories with a unified apps/ group.
 */
export const DEFAULT_GROUPS: DefaultConfig = {
  groups: {
    apps: {
      name: "Apps",
      description: "Runnable applications (services, clients, tools)",
      directory: "apps",
      defaultFor: ["service", "client", "tool"],
    },
    packages: {
      name: "Packages",
      description: "Shared libraries and packages",
      directory: "packages",
      defaultFor: ["package"],
    },
    infra: {
      name: "Infrastructure",
      description: "Infrastructure definitions",
      directory: "infra",
    },
  },
  membership: {
    service: "apps",
    client: "apps",
    tool: "apps",
    package: "packages",
  },
};

/**
 * Default CLI configuration
 * Updated to match Arbiter specification constraints
 */
export const DEFAULT_CONFIG: CLIConfig = {
  apiUrl: "http://localhost:5050", // Standardized to match server default
  timeout: 10_000, // Allow slower hops while keeping a hard cap
  format: "table",
  color: true,
  localMode: true, // Default to local/file-based mode; API mode requires explicit config
  projectDir: process.cwd(),
  projectId: generateProjectId(), // Auto-generate project ID
  projectStructure: { ...DEFAULT_PROJECT_STRUCTURE },
  uiOptions: { ...DEFAULT_UI_OPTION_CATALOG },
};

/**
 * Common ports to try for server auto-discovery
 * Listed in order of preference
 */
export const COMMON_PORTS = [5050, 3000, 4000, 8080] as const;

/**
 * Apply API URL override if provided
 */
function applyApiUrlOverride(config: CLIConfig, apiUrl: string | undefined): void {
  if (apiUrl) {
    config.apiUrl = String(apiUrl);
    config.apiUrlExplicitlyConfigured = true;
  }
}

/**
 * Apply timeout override if provided
 */
function applyTimeoutOverride(config: CLIConfig, timeout: number | string | undefined): void {
  if (timeout === undefined) return;

  const parsed = typeof timeout === "string" ? parseInt(timeout, 10) : timeout;
  if (!Number.isNaN(parsed)) {
    config.timeout = parsed;
  }
}

/**
 * Apply local mode override if provided
 */
function applyLocalModeOverride(config: CLIConfig, local: boolean | undefined): void {
  if (typeof local === "boolean") {
    config.localMode = local;
    config.localModeExplicitlySet = true;
  }
}

/**
 * Normalize URL and boolean values
 */
function normalizeConfigValues(config: CLIConfig): void {
  config.apiUrl = config.apiUrl.trim().replace(/\/+$/, "") || config.apiUrl.trim();
  config.localMode = Boolean(config.localMode);
}

/**
 * Apply CLI flag overrides (used by cli/context.ts).
 * Keeps all override rules in one place.
 */
export function applyCliOverrides(
  config: CLIConfig,
  options: {
    apiUrl?: string;
    timeout?: number | string;
    color?: boolean;
    local?: boolean;
    verbose?: boolean;
  },
): CLIConfig {
  const next = { ...config };

  applyApiUrlOverride(next, options.apiUrl);
  applyTimeoutOverride(next, options.timeout);
  applyLocalModeOverride(next, options.local);

  if (options.color === false) next.color = false;
  if (options.verbose) next.verbose = true;

  normalizeConfigValues(next);

  return next;
}

/**
 * Supported configuration file locations
 * The CLI now standardizes on `.arbiter/config.json` only.
 */
const CONFIG_FILES = [".arbiter/config.json"];

/**
 * Normalize configuration shape by renaming legacy keys.
 * @param input - Raw configuration input
 * @returns Normalized configuration object
 */
function normalizeConfigShape(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const normalized: Record<string, unknown> = { ...(input as Record<string, unknown>) };

  /**
   * Rename a configuration key from legacy to current name.
   * @param from - Legacy key name
   * @param to - Current key name
   */
  const renameKey = (from: string, to: string) => {
    if (from in normalized) {
      const value = normalized[from];
      if (normalized[to] === undefined) {
        normalized[to] = value;
      }
      delete normalized[from];
    }
  };

  renameKey("arbiter_url", "apiUrl");
  renameKey("project_dir", "projectDir");
  renameKey("project_id", "projectId");
  renameKey("project_structure", "projectStructure");
  renameKey("ui_options", "uiOptions");
  renameKey("ui_option_generators", "uiOptionGenerators");

  return normalized;
}

/**
 * Apply environment variable overrides to configuration.
 * @param config - Base CLI configuration
 * @returns Configuration with environment overrides applied
 */
export function applyEnvironmentOverrides(config: CLIConfig): CLIConfig {
  const merged = cloneConfig(config);
  const envUrl = (process.env.ARBITER_API_URL || "").trim();

  // Track if ARBITER_API_URL env var is set
  if (envUrl) {
    merged.apiUrl = envUrl;
    merged.apiUrlExplicitlyConfigured = true;
  }

  const verboseEnv = process.env.ARBITER_VERBOSE;
  if (isTruthyEnvFlag(verboseEnv)) {
    merged.verbose = true;
  }

  return merged;
}

/**
 * Derives the final localMode value based on explicit configuration.
 *
 * Logic:
 * - If --local was explicitly passed, respect that value
 * - If API URL was explicitly configured (file, env, or --api-url flag) and
 *   --local was NOT explicitly set, switch to API mode (localMode: false)
 * - Otherwise, keep the default (localMode: true for file-based saving)
 */
export function deriveLocalMode(config: CLIConfig): CLIConfig {
  // If localMode was explicitly set by the user, don't override it
  if (config.localModeExplicitlySet) {
    return config;
  }

  // If API URL was explicitly configured, enable API mode
  if (config.apiUrlExplicitlyConfigured) {
    return {
      ...config,
      localMode: false,
    };
  }

  // Otherwise, keep the default (localMode: true)
  return config;
}

/**
 * Merge two configuration objects with deep merge for nested properties.
 * @param base - Base configuration
 * @param overrides - Override values to merge in
 * @returns Merged configuration
 */
/**
 * Deep merge default configuration.
 * Groups are merged by key, with override groups taking precedence.
 */
function mergeDefaultConfig(
  base: CLIConfig["default"],
  overrides: CLIConfig["default"],
): CLIConfig["default"] {
  if (!overrides) return base;
  if (!base) return overrides;

  // Merge groups by key
  const mergedGroups = { ...base.groups };
  if (overrides.groups) {
    for (const [key, group] of Object.entries(overrides.groups)) {
      mergedGroups[key] = base.groups?.[key] ? { ...base.groups[key], ...group } : group;
    }
  }

  // Merge membership
  const mergedMembership = {
    ...base.membership,
    ...overrides.membership,
  };

  return {
    groups: mergedGroups,
    membership: mergedMembership,
  };
}

function mergeConfigs(base: CLIConfig, overrides: Partial<CLIConfig>): CLIConfig {
  const mergedGithub = overrides.github
    ? {
        ...base.github,
        ...overrides.github,
        repository: overrides.github.repository
          ? { ...base.github?.repository, ...overrides.github.repository }
          : base.github?.repository,
        prefixes: overrides.github.prefixes
          ? { ...base.github?.prefixes, ...overrides.github.prefixes }
          : base.github?.prefixes,
        labels: overrides.github.labels
          ? { ...base.github?.labels, ...overrides.github.labels }
          : base.github?.labels,
        automation: overrides.github.automation
          ? { ...base.github?.automation, ...overrides.github.automation }
          : base.github?.automation,
        templates: overrides.github.templates
          ? { ...base.github?.templates, ...overrides.github.templates }
          : base.github?.templates,
      }
    : base.github;

  const merged: CLIConfig = {
    ...base,
    ...overrides,
    github: mergedGithub,
    projectStructure: {
      ...DEFAULT_PROJECT_STRUCTURE,
      ...base.projectStructure,
      ...(overrides.projectStructure ?? {}),
      packageRelative: {
        ...DEFAULT_PROJECT_STRUCTURE.packageRelative,
        ...(base.projectStructure.packageRelative ?? {}),
        ...(overrides.projectStructure?.packageRelative ?? {}),
      },
    },
    default: mergeDefaultConfig(base.default, overrides.default),
    uiOptions: mergeOptionCatalog(base.uiOptions, overrides.uiOptions),
    uiOptionGenerators: mergeOptionGenerators(
      base.uiOptionGenerators,
      overrides.uiOptionGenerators,
    ),
    generator: mergeGeneratorConfig(base.generator, overrides.generator),
    configFilePath: overrides.configFilePath ?? base.configFilePath,
    configDir: overrides.configDir ?? base.configDir,
    authSession: base.authSession,
    // Preserve explicit configuration tracking flags (once set, stays set)
    apiUrlExplicitlyConfigured:
      overrides.apiUrlExplicitlyConfigured || base.apiUrlExplicitlyConfigured,
    localModeExplicitlySet: overrides.localModeExplicitlySet || base.localModeExplicitlySet,
  };

  return merged;
}

/**
 * Load CLI configuration from file or default.
 * @param configPath - Optional explicit config file path
 * @returns Promise resolving to loaded CLIConfig
 */
export async function loadConfig(configPath?: string): Promise<CLIConfig> {
  const baseConfig = cloneConfig(DEFAULT_CONFIG);

  const resolved = configPath
    ? await loadSpecificConfigFile(configPath, baseConfig)
    : await searchForConfigFile(baseConfig);

  return applyEnvironmentOverrides(resolved);
}

/**
 * Load configuration with Git auto-detection integration
 * This is called after the initial config load to enhance with Git info
 */
export async function loadConfigWithGitDetection(
  baseConfig: CLIConfig,
  options: {
    useConfig?: boolean;
    useGitRemote?: boolean;
    verbose?: boolean;
  } = {},
): Promise<CLIConfig> {
  const { getSmartRepositoryConfig } = await import("@/utils/io/git-detection.js");

  // Always try to get smart repository config, which handles conflicts
  const smartRepoConfig = getSmartRepositoryConfig(baseConfig.github?.repository, options);

  if (smartRepoConfig) {
    // Merge detected repository info into config
    const enhancedConfig = mergeConfigs(baseConfig, {
      github: {
        ...baseConfig.github,
        repository: {
          ...baseConfig.github?.repository,
          owner: smartRepoConfig.repo.owner,
          repo: smartRepoConfig.repo.repo,
        },
      },
    });

    if (options.verbose) {
      console.log(
        chalk.green(
          `✅ Enhanced config with ${smartRepoConfig.source} repository: ${smartRepoConfig.repo.owner}/${smartRepoConfig.repo.repo}`,
        ),
      );
    }

    return applyEnvironmentOverrides(enhancedConfig);
  }

  // If no smart config found, return original
  return applyEnvironmentOverrides(baseConfig);
}

/**
 * Load a specific configuration file
 */
async function loadSpecificConfigFile(
  configPath: string,
  baseConfig: CLIConfig,
): Promise<CLIConfig> {
  if (!(await fs.pathExists(configPath))) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const userConfig = await loadConfigFile(configPath);
  return mergeConfigs(baseConfig, userConfig);
}

/**
 * Get directories from a root directory up to the current working directory.
 * Returns directories in order from root to cwd (least specific to most specific).
 */
function getDirectoriesFromRootToCwd(rootDir: string, cwd: string): string[] {
  const dirs: string[] = [];
  let current = cwd;

  // Normalize paths for comparison
  const normalizedRoot = path.resolve(rootDir);
  const normalizedCwd = path.resolve(current);

  // Collect from cwd up to rootDir
  while (normalizedCwd.startsWith(normalizedRoot) || current === normalizedRoot) {
    dirs.unshift(current); // Add to front so order is root → cwd
    if (path.resolve(current) === normalizedRoot) break;
    const parent = path.dirname(current);
    if (parent === current) break; // Reached filesystem root
    current = parent;
  }

  return dirs;
}

/**
 * Search for and merge configuration files from multiple directories.
 *
 * Search order:
 * 1. Home directory (~/.arbiter/config.json) - base layer
 * 2. If in git repo: git root → ... → cwd (directory climbing within repo)
 * 3. If NOT in git repo: only cwd (no directory climbing)
 *
 * Configs are merged in order with more specific (closer to cwd) overriding less specific.
 */
/**
 * Collected config entry with path information
 */
interface ConfigEntry {
  configPath: string;
  config: Partial<CLIConfig>;
}

/**
 * Load config from home directory if it exists
 */
async function loadHomeConfig(): Promise<ConfigEntry | null> {
  const homeDir = typeof os.homedir === "function" ? os.homedir() : null;
  if (!homeDir) return null;

  const homeConfig = await findConfigInDirectory(homeDir);
  if (!homeConfig?.configFilePath) return null;

  return { configPath: homeConfig.configFilePath, config: homeConfig };
}

/**
 * Load configs from git repo directories (gitRoot → cwd)
 */
async function loadGitRepoConfigs(
  gitRoot: string,
  cwd: string,
  homeDir: string | null,
): Promise<ConfigEntry[]> {
  const configs: ConfigEntry[] = [];
  const searchDirs = getDirectoriesFromRootToCwd(gitRoot, cwd);

  for (const dir of searchDirs) {
    // Skip home directory if it's in the path (already checked above)
    if (homeDir && path.resolve(dir) === path.resolve(homeDir)) {
      continue;
    }
    const dirConfig = await findConfigInDirectory(dir);
    if (dirConfig?.configFilePath) {
      configs.push({ configPath: dirConfig.configFilePath, config: dirConfig });
    }
  }

  return configs;
}

/**
 * Load config from cwd only (non-git context)
 */
async function loadCwdConfig(cwd: string, homeDir: string | null): Promise<ConfigEntry | null> {
  // Skip if cwd is home directory (already checked above)
  if (homeDir && path.resolve(cwd) === path.resolve(homeDir)) {
    return null;
  }

  const cwdConfig = await findConfigInDirectory(cwd);
  if (!cwdConfig?.configFilePath) return null;

  return { configPath: cwdConfig.configFilePath, config: cwdConfig };
}

/**
 * Merge all collected configs into base config
 */
function mergeCollectedConfigs(baseConfig: CLIConfig, configs: ConfigEntry[]): CLIConfig {
  let merged = baseConfig;
  const loadedPaths: string[] = [];

  for (const { configPath, config } of configs) {
    merged = mergeConfigs(merged, config);
    loadedPaths.push(configPath);
  }

  merged.loadedConfigPaths = loadedPaths.length > 0 ? loadedPaths : undefined;

  if (configs.length > 0) {
    const mostSpecific = configs[configs.length - 1];
    merged.configFilePath = mostSpecific.configPath;
    merged.configDir = path.dirname(mostSpecific.configPath);
  }

  return merged;
}

async function searchForConfigFile(baseConfig: CLIConfig): Promise<CLIConfig> {
  const configs: ConfigEntry[] = [];
  const cwd = process.cwd();
  const homeDir = typeof os.homedir === "function" ? os.homedir() : null;

  // 1. Check home directory first (base layer)
  const homeConfig = await loadHomeConfig();
  if (homeConfig) configs.push(homeConfig);

  // 2. Determine search directories based on git context
  const gitRoot = findGitRoot(cwd);

  if (gitRoot) {
    const repoConfigs = await loadGitRepoConfigs(gitRoot, cwd, homeDir);
    configs.push(...repoConfigs);
  } else {
    const cwdConfig = await loadCwdConfig(cwd, homeDir);
    if (cwdConfig) configs.push(cwdConfig);
  }

  // 3. Merge all configs in order (home → repo_root → ... → cwd)
  return mergeCollectedConfigs(baseConfig, configs);
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

  const normalized = normalizeConfigShape(parsed);

  // Validate configuration
  const result = configSchema.safeParse(normalized);
  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }

  const loadedConfig: Partial<CLIConfig> = {
    ...(result.data as unknown as Partial<CLIConfig>),
    configFilePath: filePath,
    configDir: path.dirname(filePath),
  };

  // Track if apiUrl was explicitly configured in the file
  if (result.data.apiUrl) {
    loadedConfig.apiUrlExplicitlyConfigured = true;
  }

  // Track if localMode was explicitly set in the file
  if (typeof normalized.localMode === "boolean") {
    loadedConfig.localModeExplicitlySet = true;
  }

  return loadedConfig;
}

/**
 * Prepare configuration for saving by removing internal fields.
 * @param config - Configuration to prepare
 * @returns Serializable configuration object
 */
function prepareConfigForSave(config: Partial<CLIConfig>): Record<string, unknown> {
  const serializable: Record<string, unknown> = { ...config };

  delete serializable.authSession;
  delete serializable.configFilePath;
  delete serializable.configDir;
  delete serializable.loadedConfigPaths;
  // Remove internal tracking fields (not user-facing config)
  delete serializable.apiUrlExplicitlyConfigured;
  delete serializable.localModeExplicitlySet;

  if (serializable.apiUrl) {
    serializable.arbiter_url = serializable.apiUrl;
    delete serializable.apiUrl;
  }

  return serializable;
}

/**
 * Save configuration to a file in JSON or YAML format.
 * @param config - Configuration to save
 * @param filePath - Path to save configuration file
 */
export async function saveConfig(config: Partial<CLIConfig>, filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();
  const serializable = prepareConfigForSave(config);
  let content: string;

  if (ext === ".json") {
    content = JSON.stringify(serializable, null, 2);
  } else if (ext === ".yaml" || ext === ".yml") {
    content = yaml.stringify(serializable);
  } else {
    throw new Error(`Unsupported configuration file format: ${ext}`);
  }

  // Ensure the directory exists
  await fs.ensureDir(path.dirname(filePath));
  await safeFileOperation("write", filePath, async (validatedPath) => {
    await fs.writeFile(validatedPath, content, "utf-8");
  });
}

/**
 * Get default configuration file path
 */
export function getDefaultConfigPath(): string {
  return path.join(process.cwd(), ".arbiter", "config.json");
}

export type Config = CLIConfig;
