import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import fs from 'fs-extra';
import yaml from 'yaml';
import { z } from 'zod';
import type { CLIConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default CLI configuration
 * Updated to match Arbiter specification constraints
 */
export const DEFAULT_CONFIG: CLIConfig = {
  apiUrl: 'http://localhost:5050', // Standardized to match server default
  timeout: 750, // Enforce spec maximum (≤750ms)
  format: 'table',
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
  type: z.enum(['text', 'number', 'date', 'select', 'boolean']).optional(),
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
          })
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

const configSchema = z.object({
  apiUrl: z.string().url().optional(),
  timeout: z.number().min(100).max(750).optional(), // Enforce spec maximum (≤750ms)
  format: z.enum(['table', 'json', 'yaml']).optional(),
  color: z.boolean().optional(),
  projectDir: z.string().optional(),
  github: gitHubSyncSchema.optional(),
});

/**
 * Possible configuration file names
 */
const CONFIG_FILES = [
  '.arbiter/config.json',
  '.arbiter/config.yaml',
  '.arbiter/config.yml',
  // Legacy paths for backward compatibility
  '.arbiter.json',
  '.arbiter.yaml',
  '.arbiter.yml',
  'arbiter.json',
  'arbiter.yaml',
  'arbiter.yml',
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
 * Load configuration with Git auto-detection integration
 * This is called after the initial config load to enhance with Git info
 */
export async function loadConfigWithGitDetection(
  baseConfig: CLIConfig,
  options: {
    useConfig?: boolean;
    useGitRemote?: boolean;
    verbose?: boolean;
  } = {}
): Promise<CLIConfig> {
  const { getSmartRepositoryConfig } = await import('./utils/git-detection.js');

  // Always try to get smart repository config, which handles conflicts
  const smartRepoConfig = getSmartRepositoryConfig(baseConfig.github?.repository, options);

  if (smartRepoConfig) {
    // Merge detected repository info into config
    const enhancedConfig: CLIConfig = {
      ...baseConfig,
      github: {
        ...baseConfig.github,
        repository: {
          ...baseConfig.github?.repository,
          owner: smartRepoConfig.repo.owner,
          repo: smartRepoConfig.repo.repo,
        },
      },
    };

    if (options.verbose) {
      console.log(
        chalk.green(
          `✅ Enhanced config with ${smartRepoConfig.source} repository: ${smartRepoConfig.repo.owner}/${smartRepoConfig.repo.repo}`
        )
      );
    }

    return enhancedConfig;
  }

  // If no smart config found, return original
  return baseConfig;
}

/**
 * Load a specific configuration file
 */
async function loadSpecificConfigFile(
  configPath: string,
  baseConfig: CLIConfig
): Promise<CLIConfig> {
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
  const content = await fs.readFile(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  let parsed: unknown;

  if (ext === '.json') {
    parsed = JSON.parse(content);
  } else if (ext === '.yaml' || ext === '.yml') {
    parsed = yaml.parse(content);
  } else {
    throw new Error(`Unsupported configuration file format: ${ext}`);
  }

  // Validate configuration
  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }

  return result.data as unknown as Partial<CLIConfig>;
}

/**
 * Save configuration to file
 */
export async function saveConfig(config: Partial<CLIConfig>, filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();
  let content: string;

  if (ext === '.json') {
    content = JSON.stringify(config, null, 2);
  } else if (ext === '.yaml' || ext === '.yml') {
    content = yaml.stringify(config);
  } else {
    throw new Error(`Unsupported configuration file format: ${ext}`);
  }

  // Ensure the directory exists
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Get default configuration file path
 */
export function getDefaultConfigPath(): string {
  return path.join(process.cwd(), '.arbiter', 'config.json');
}

export type Config = CLIConfig;
