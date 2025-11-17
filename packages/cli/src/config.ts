import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARRAY_UI_OPTION_KEYS,
  DEFAULT_UI_OPTION_CATALOG,
  type UIOptionCatalog,
  type UIOptionGeneratorMap,
  UI_OPTION_KEYS,
} from "@arbiter/shared";
import chalk from "chalk";
import fs from "fs-extra";
import yaml from "yaml";
import { z } from "zod";
import type {
  CLIConfig,
  DockerGeneratorConfig,
  DockerTemplateConfig,
  GeneratorConfig,
  GeneratorTestingConfig,
  LanguageTestingConfig,
  MasterTestRunnerConfig,
  ProjectStructureConfig,
} from "./types.js";

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
  modulesDirectory: "modules",
  toolsDirectory: "tools",
  docsDirectory: "docs",
  testsDirectory: "tests",
  infraDirectory: "infra",
  endpointDirectory: "services/endpoints",
};

/**
 * Default CLI configuration
 * Updated to match Arbiter specification constraints
 */
export const DEFAULT_CONFIG: CLIConfig = {
  apiUrl: "http://localhost:5050", // Standardized to match server default
  timeout: 750, // Enforce spec maximum (≤750ms)
  format: "table",
  color: true,
  localMode: false,
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
 * Configuration file schema for validation
 * Enforces Arbiter specification constraints
 */
const gitHubRepoSchema = z.object({
  owner: z.string().optional(), // Made optional for auto-detection
  repo: z.string().optional(), // Made optional for auto-detection
  token: z.string().optional(),
  baseUrl: z.string().url().optional(),
  tokenEnv: z.string().optional(),
});

const gitHubTemplateFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  required: z.boolean().optional(),
  type: z.enum(["text", "number", "date", "select", "boolean"]).optional(),
  default: z.string().optional(),
  pattern: z.string().optional(),
  help: z.string().optional(),
});

const gitHubFieldValidationSchema = z.object({
  field: z.string(),
  required: z.boolean().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  enum: z.array(z.string()).optional(),
  validator: z.string().optional(),
  errorMessage: z.string().optional(),
});

const gitHubTemplateSectionsSchema = z.object({
  description: z.string(),
  details: z.array(gitHubTemplateFieldSchema).optional(),
  acceptanceCriteria: z.string().optional(),
  dependencies: z.string().optional(),
  additional: z.record(z.string()).optional(),
});

const gitHubTemplateValidationSchema = z.object({
  fields: z.array(gitHubFieldValidationSchema).optional(),
  custom: z.array(z.string()).optional(),
});

const gitHubTemplateSetSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  sections: gitHubTemplateSectionsSchema,
  labels: z.array(z.string()).optional(),
  validation: gitHubTemplateValidationSchema.optional(),
});

const gitHubTemplateOptionsSchema = z.object({
  includeMetadata: z.boolean().optional(),
  includeArbiterIds: z.boolean().optional(),
  includeAcceptanceCriteria: z.boolean().optional(),
  includeDependencies: z.boolean().optional(),
  includeEstimations: z.boolean().optional(),
  customFields: z.record(z.string()).optional(),
});

const gitHubTemplateConfigSchema = z.object({
  inherits: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  sections: gitHubTemplateSectionsSchema.partial().optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  validation: gitHubTemplateValidationSchema.optional(),
  options: gitHubTemplateOptionsSchema.optional(),
});

const gitHubLabelSchema = z.object({
  name: z.string(),
  color: z.string(),
  description: z.string().optional(),
});

const gitHubRepoConfigSchema = z.object({
  issueConfig: z
    .object({
      blankIssuesEnabled: z.boolean().optional(),
      contactLinks: z
        .array(
          z.object({
            name: z.string(),
            url: z.string().url(),
            about: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
  labels: z.array(gitHubLabelSchema).optional(),
  pullRequestTemplate: z.string().optional(),
});

const gitHubTemplatesConfigSchema = z.object({
  base: gitHubTemplateSetSchema.optional(),
  epic: gitHubTemplateConfigSchema.optional(),
  task: gitHubTemplateConfigSchema.optional(),
  bugReport: gitHubTemplateConfigSchema.optional(),
  featureRequest: gitHubTemplateConfigSchema.optional(),
  repositoryConfig: gitHubRepoConfigSchema.optional(),
});

const gitHubSyncSchema = z.object({
  repository: gitHubRepoSchema,
  mapping: z
    .object({
      epicLabels: z.record(z.array(z.string())).optional(),
      taskLabels: z.record(z.array(z.string())).optional(),
      defaultLabels: z.array(z.string()).optional(),
      epicPrefix: z.string().optional(),
      taskPrefix: z.string().optional(),
    })
    .optional(),
  behavior: z
    .object({
      createMilestones: z.boolean().optional(),
      autoClose: z.boolean().optional(),
      syncAcceptanceCriteria: z.boolean().optional(),
      syncAssignees: z.boolean().optional(),
    })
    .optional(),
  templates: gitHubTemplatesConfigSchema.optional(),
});

const projectStructureSchema = z
  .object({
    clientsDirectory: z.string().optional(),
    servicesDirectory: z.string().optional(),
    modulesDirectory: z.string().optional(),
    toolsDirectory: z.string().optional(),
    docsDirectory: z.string().optional(),
    testsDirectory: z.string().optional(),
    infraDirectory: z.string().optional(),
    endpointDirectory: z.string().optional(),
  })
  .optional();

const uiOptionCatalogSchema = z
  .object({
    frontendFrameworks: z.array(z.string()).optional(),
    serviceLanguages: z.array(z.string()).optional(),
    serviceFrameworks: z.record(z.string(), z.array(z.string())).optional(),
    databaseEngines: z.array(z.string()).optional(),
    infrastructureScopes: z.array(z.string()).optional(),
  })
  .optional();

const uiOptionGeneratorsSchema = z
  .object({
    frontendFrameworks: z.string().optional(),
    serviceLanguages: z.string().optional(),
    serviceFrameworks: z.string().optional(),
    databaseEngines: z.string().optional(),
    infrastructureScopes: z.string().optional(),
  })
  .optional();

const generatorHooksSchema = z
  .object({
    "before:generate": z.string().optional(),
    "after:generate": z.string().optional(),
    "before:fileWrite": z.string().optional(),
    "after:fileWrite": z.string().optional(),
  })
  .optional();

const testingLanguageSchema = z.object({
  framework: z.string().optional(),
  outputDir: z.string().optional(),
  command: z.string().optional(),
  options: z.record(z.unknown()).optional(),
});

const generatorTestingSchema = z
  .object({
    master: z
      .object({
        type: z.enum(["make", "node"]).optional(),
        output: z.string().optional(),
      })
      .optional(),
  })
  .catchall(testingLanguageSchema)
  .optional();

const dockerTemplateSchema = z
  .object({
    dockerfile: z.string().optional(),
    dockerignore: z.string().optional(),
  })
  .strict();

const dockerGeneratorSchema = z
  .object({
    defaults: z
      .object({
        service: dockerTemplateSchema.optional(),
        client: dockerTemplateSchema.optional(),
      })
      .optional(),
    services: z.record(z.string(), dockerTemplateSchema).optional(),
    clients: z.record(z.string(), dockerTemplateSchema).optional(),
  })
  .optional();

const generatorSchema = z
  .object({
    templateOverrides: z.record(z.string(), z.string()).optional(),
    plugins: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    hooks: generatorHooksSchema,
    testing: generatorTestingSchema,
    docker: dockerGeneratorSchema,
  })
  .optional();

const configSchema = z.object({
  apiUrl: z.string().url().optional(),
  timeout: z.number().min(100).max(750).optional(), // Enforce spec maximum (≤750ms)
  format: z.enum(["table", "json", "yaml"]).optional(),
  color: z.boolean().optional(),
  projectDir: z.string().optional(),
  projectId: z.string().optional(),
  github: gitHubSyncSchema.optional(),
  projectStructure: projectStructureSchema,
  uiOptions: uiOptionCatalogSchema,
  uiOptionGenerators: uiOptionGeneratorsSchema,
  generator: generatorSchema,
});

/**
 * Possible configuration file names
 */
const CONFIG_FILES = [
  ".arbiter/config.json",
  ".arbiter/config.yaml",
  ".arbiter/config.yml",
  // Legacy paths for backward compatibility
  ".arbiter.json",
  ".arbiter.yaml",
  ".arbiter.yml",
  "arbiter.json",
  "arbiter.yaml",
  "arbiter.yml",
];

function normalizeConfigShape(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const normalized: Record<string, unknown> = { ...(input as Record<string, unknown>) };

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

function cloneFrameworkMap(map?: Record<string, string[]>): Record<string, string[]> | undefined {
  if (!map) return undefined;
  return Object.fromEntries(
    Object.entries(map).map(([language, frameworks]) => [language, [...frameworks]]),
  );
}

function cloneUIOptionCatalog(options?: UIOptionCatalog): UIOptionCatalog | undefined {
  if (!options) return undefined;

  const cloned: UIOptionCatalog = {};

  for (const key of ARRAY_UI_OPTION_KEYS) {
    const values = options[key];
    if (Array.isArray(values)) {
      cloned[key] = [...values];
    }
  }

  if (options.serviceFrameworks) {
    const frameworks = cloneFrameworkMap(options.serviceFrameworks);
    if (frameworks) {
      cloned.serviceFrameworks = frameworks;
    } else {
      cloned.serviceFrameworks = {};
    }
  }

  return Object.keys(cloned).length > 0 ? cloned : undefined;
}

function deepClone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneGeneratorConfig(config?: GeneratorConfig): GeneratorConfig | undefined {
  if (!config) return undefined;

  return {
    templateOverrides: config.templateOverrides ? { ...config.templateOverrides } : undefined,
    plugins: config.plugins
      ? Object.fromEntries(
          Object.entries(config.plugins).map(([language, options]) => [
            language,
            deepClone(options),
          ]),
        )
      : undefined,
    hooks: config.hooks ? { ...config.hooks } : undefined,
    testing: cloneTestingConfig(config.testing),
    docker: cloneDockerConfig(config.docker),
  };
}

function cloneDockerConfig(config?: DockerGeneratorConfig): DockerGeneratorConfig | undefined {
  if (!config) return undefined;

  const cloned = deepClone(config) as DockerGeneratorConfig;
  return Object.keys(cloned).length > 0 ? cloned : undefined;
}

function cloneTestingConfig(testing?: GeneratorTestingConfig): GeneratorTestingConfig | undefined {
  if (!testing) return undefined;
  const cloned: GeneratorTestingConfig = {} as GeneratorTestingConfig;
  for (const [key, value] of Object.entries(testing)) {
    if (key === "master") {
      if (value) {
        (cloned as GeneratorTestingConfig).master = { ...(value as MasterTestRunnerConfig) };
      }
    } else if (value) {
      (cloned as Record<string, LanguageTestingConfig>)[key] = deepClone(
        value as LanguageTestingConfig,
      );
    }
  }
  return Object.keys(cloned).length > 0 ? cloned : undefined;
}

function mergeDockerTemplateEntry(
  base?: DockerTemplateConfig,
  overrides?: DockerTemplateConfig,
): DockerTemplateConfig | undefined {
  if (!base && !overrides) return undefined;
  const merged: DockerTemplateConfig = {
    ...(base ?? {}),
    ...(overrides ?? {}),
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeDockerTemplateRecord(
  base?: Record<string, DockerTemplateConfig>,
  overrides?: Record<string, DockerTemplateConfig>,
): Record<string, DockerTemplateConfig> | undefined {
  if (!base && !overrides) return undefined;
  const merged: Record<string, DockerTemplateConfig> = {};
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(overrides ?? {})]);

  for (const key of keys) {
    const value = mergeDockerTemplateEntry(base?.[key], overrides?.[key]);
    if (value) {
      merged[key] = value;
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeDockerDefaults(
  base?: { service?: DockerTemplateConfig; client?: DockerTemplateConfig },
  overrides?: { service?: DockerTemplateConfig; client?: DockerTemplateConfig },
): { service?: DockerTemplateConfig; client?: DockerTemplateConfig } | undefined {
  if (!base && !overrides) return undefined;

  const service = mergeDockerTemplateEntry(base?.service, overrides?.service);
  const client = mergeDockerTemplateEntry(base?.client, overrides?.client);

  const merged: { service?: DockerTemplateConfig; client?: DockerTemplateConfig } = {};
  if (service) merged.service = service;
  if (client) merged.client = client;

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeDockerConfig(
  base?: DockerGeneratorConfig,
  overrides?: DockerGeneratorConfig,
): DockerGeneratorConfig | undefined {
  if (!base && !overrides) return undefined;

  const defaults = mergeDockerDefaults(base?.defaults, overrides?.defaults);
  const services = mergeDockerTemplateRecord(base?.services, overrides?.services);
  const clients = mergeDockerTemplateRecord(base?.clients, overrides?.clients);

  const merged: DockerGeneratorConfig = {};
  if (defaults) merged.defaults = defaults;
  if (services) merged.services = services;
  if (clients) merged.clients = clients;

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeTestingConfig(
  base: GeneratorTestingConfig | undefined,
  overrides: GeneratorTestingConfig | undefined,
): GeneratorTestingConfig | undefined {
  if (!base && !overrides) return undefined;

  const merged: GeneratorTestingConfig = {} as GeneratorTestingConfig;

  if (base) {
    for (const [key, value] of Object.entries(base)) {
      if (key === "master") {
        if (value) {
          (merged as GeneratorTestingConfig).master = { ...(value as MasterTestRunnerConfig) };
        }
      } else if (value) {
        (merged as Record<string, LanguageTestingConfig>)[key] = deepClone(
          value as LanguageTestingConfig,
        );
      }
    }
  }

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (!value) continue;
      if (key === "master") {
        (merged as GeneratorTestingConfig).master = {
          ...(merged.master ?? {}),
          ...(value as MasterTestRunnerConfig),
        };
      } else {
        const existing = (merged as Record<string, LanguageTestingConfig>)[key];
        (merged as Record<string, LanguageTestingConfig>)[key] = existing
          ? { ...existing, ...deepClone(value as LanguageTestingConfig) }
          : deepClone(value as LanguageTestingConfig);
      }
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Load CLI configuration from file or use defaults
 */
function cloneConfig(config: CLIConfig): CLIConfig {
  return {
    ...config,
    projectStructure: { ...config.projectStructure },
    uiOptions: cloneUIOptionCatalog(config.uiOptions),
    uiOptionGenerators: config.uiOptionGenerators ? { ...config.uiOptionGenerators } : undefined,
    configFilePath: config.configFilePath,
    configDir: config.configDir,
    authSession: config.authSession
      ? {
          ...config.authSession,
          metadata: config.authSession.metadata ? { ...config.authSession.metadata } : undefined,
        }
      : undefined,
    github: config.github
      ? {
          ...config.github,
          repository: config.github.repository ? { ...config.github.repository } : undefined,
          mapping: config.github.mapping ? { ...config.github.mapping } : undefined,
          behavior: config.github.behavior ? { ...config.github.behavior } : undefined,
          templates: config.github.templates ? { ...config.github.templates } : undefined,
        }
      : undefined,
    generator: cloneGeneratorConfig(config.generator),
  };
}

export function applyEnvironmentOverrides(config: CLIConfig): CLIConfig {
  const merged = cloneConfig(config);
  const envUrl = (process.env.ARBITER_URL || process.env.ARBITER_API_URL || "").trim();

  if (envUrl) {
    merged.apiUrl = envUrl;
  }

  return merged;
}

function mergeOptionCatalog(
  base: UIOptionCatalog | undefined,
  overrides: UIOptionCatalog | undefined,
): UIOptionCatalog | undefined {
  if (!base && !overrides) return undefined;
  const merged: UIOptionCatalog = {};

  for (const key of ARRAY_UI_OPTION_KEYS) {
    const overrideValues = overrides?.[key];
    const baseValues = base?.[key];

    if (Array.isArray(overrideValues)) {
      merged[key] = [...overrideValues];
    } else if (Array.isArray(baseValues)) {
      merged[key] = [...baseValues];
    }
  }

  if (overrides?.serviceFrameworks) {
    merged.serviceFrameworks = cloneFrameworkMap(overrides.serviceFrameworks) ?? {};
  } else if (base?.serviceFrameworks) {
    merged.serviceFrameworks = cloneFrameworkMap(base.serviceFrameworks) ?? {};
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeOptionGenerators(
  base: UIOptionGeneratorMap | undefined,
  overrides: UIOptionGeneratorMap | undefined,
): UIOptionGeneratorMap | undefined {
  if (!base && !overrides) return undefined;
  const merged: UIOptionGeneratorMap = {};
  for (const key of UI_OPTION_KEYS) {
    if (overrides?.[key]) {
      merged[key] = overrides[key];
    } else if (base?.[key]) {
      merged[key] = base[key];
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeGeneratorConfig(
  base: GeneratorConfig | undefined,
  overrides: GeneratorConfig | undefined,
): GeneratorConfig | undefined {
  if (!base && !overrides) return undefined;

  const templateOverrides = {
    ...(base?.templateOverrides ?? {}),
    ...(overrides?.templateOverrides ?? {}),
  } as Record<string, string>;

  const pluginConfig: Record<string, Record<string, unknown>> = {};
  if (base?.plugins) {
    for (const [language, options] of Object.entries(base.plugins)) {
      pluginConfig[language] = deepClone(options);
    }
  }
  if (overrides?.plugins) {
    for (const [language, options] of Object.entries(overrides.plugins)) {
      pluginConfig[language] = pluginConfig[language]
        ? { ...pluginConfig[language], ...deepClone(options) }
        : deepClone(options);
    }
  }

  const hookConfig = {
    ...(base?.hooks ?? {}),
    ...(overrides?.hooks ?? {}),
  } as Record<string, string>;

  const testingConfig = mergeTestingConfig(base?.testing, overrides?.testing);
  const dockerConfig = mergeDockerConfig(base?.docker, overrides?.docker);

  const hasTemplateOverrides = Object.keys(templateOverrides).length > 0;
  const hasPlugins = Object.keys(pluginConfig).length > 0;
  const hasHooks = Object.keys(hookConfig).length > 0;
  const hasTesting = testingConfig !== undefined;
  const hasDocker = dockerConfig !== undefined;

  if (!hasTemplateOverrides && !hasPlugins && !hasHooks && !hasTesting && !hasDocker) {
    return undefined;
  }

  return {
    templateOverrides: hasTemplateOverrides ? templateOverrides : undefined,
    plugins: hasPlugins ? pluginConfig : undefined,
    hooks: hasHooks ? hookConfig : undefined,
    testing: testingConfig,
    docker: dockerConfig,
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
        mapping: overrides.github.mapping
          ? { ...base.github?.mapping, ...overrides.github.mapping }
          : base.github?.mapping,
        behavior: overrides.github.behavior
          ? { ...base.github?.behavior, ...overrides.github.behavior }
          : base.github?.behavior,
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
    },
    uiOptions: mergeOptionCatalog(base.uiOptions, overrides.uiOptions),
    uiOptionGenerators: mergeOptionGenerators(
      base.uiOptionGenerators,
      overrides.uiOptionGenerators,
    ),
    generator: mergeGeneratorConfig(base.generator, overrides.generator),
    configFilePath: overrides.configFilePath ?? base.configFilePath,
    configDir: overrides.configDir ?? base.configDir,
    authSession: base.authSession,
  };

  return merged;
}

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
  const { getSmartRepositoryConfig } = await import("./utils/git-detection.js");

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
 * Search for configuration files up the directory tree
 */
async function searchForConfigFile(baseConfig: CLIConfig): Promise<CLIConfig> {
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (true) {
    const foundConfig = await findConfigInDirectory(currentDir);
    if (foundConfig) {
      return mergeConfigs(baseConfig, foundConfig);
    }

    if (currentDir === root) {
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  const homeDir = typeof os.homedir === "function" ? os.homedir() : null;
  if (homeDir) {
    const foundConfig = await findConfigInDirectory(homeDir);
    if (foundConfig) {
      return mergeConfigs(baseConfig, foundConfig);
    }
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

  const normalized = normalizeConfigShape(parsed);

  // Validate configuration
  const result = configSchema.safeParse(normalized);
  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }

  return {
    ...(result.data as unknown as Partial<CLIConfig>),
    configFilePath: filePath,
    configDir: path.dirname(filePath),
  };
}

function prepareConfigForSave(config: Partial<CLIConfig>): Record<string, unknown> {
  const serializable: Record<string, unknown> = { ...config };

  delete serializable.authSession;
  delete serializable.configFilePath;
  delete serializable.configDir;

  if (serializable.apiUrl) {
    serializable.arbiter_url = serializable.apiUrl;
    delete serializable.apiUrl;
  }

  return serializable;
}

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
  await fs.writeFile(filePath, content, "utf-8");
}

/**
 * Get default configuration file path
 */
export function getDefaultConfigPath(): string {
  return path.join(process.cwd(), ".arbiter", "config.json");
}

export type Config = CLIConfig;
