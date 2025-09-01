import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import type { CLIConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default CLI configuration
 * Updated to match Arbiter specification constraints
 */
export const DEFAULT_CONFIG: CLIConfig = {
  apiUrl: 'http://localhost:4001', // Match spec default
  timeout: 750, // Enforce spec maximum (≤750ms)
  format: 'table',
  color: true,
  projectDir: process.cwd(),
};

/**
 * Configuration file schema for validation
 * Enforces Arbiter specification constraints
 */
const configSchema = z.object({
  apiUrl: z.string().url().optional(),
  timeout: z.number().min(100).max(750).optional(), // Enforce spec maximum (≤750ms)
  format: z.enum(['table', 'json', 'yaml']).optional(),
  color: z.boolean().optional(),
  projectDir: z.string().optional(),
});

/**
 * Possible configuration file names
 */
const CONFIG_FILES = [
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
  let config = { ...DEFAULT_CONFIG };

  // If specific config path provided, use it
  if (configPath) {
    if (await fs.pathExists(configPath)) {
      const userConfig = await loadConfigFile(configPath);
      config = { ...config, ...userConfig };
    } else {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    return config;
  }

  // Look for config files in current directory and up the tree
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    for (const fileName of CONFIG_FILES) {
      const configFile = path.join(currentDir, fileName);
      if (await fs.pathExists(configFile)) {
        const userConfig = await loadConfigFile(configFile);
        config = { ...config, ...userConfig };
        return config;
      }
    }
    currentDir = path.dirname(currentDir);
  }

  return config;
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

  return result.data;
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

  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Get default configuration file path
 */
export function getDefaultConfigPath(): string {
  return path.join(process.cwd(), '.arbiter.json');
}