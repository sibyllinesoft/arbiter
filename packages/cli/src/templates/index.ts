/**
 * Pluggable Template System
 *
 * This module provides a pluggable template system with clean alias configuration
 * that keeps implementation details separate from CUE specifications.
 */

import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";

/**
 * Helper function to replace execa with spawn
 */
async function execCommand(
  command: string,
  args: string[],
  options: { env?: Record<string, string>; cwd?: string } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...options.env },
      cwd: options.cwd || process.cwd(),
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(" ")}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Template engine interface
 */
export interface TemplateEngine {
  name: string;
  command: string;
  defaultArgs: string[];
  validate?(source: string): Promise<boolean>;
  execute(source: string, destination: string, variables: Record<string, any>): Promise<void>;
}

/**
 * Template alias configuration
 */
export interface TemplateAlias {
  engine: string;
  source: string;
  description: string;
  variables?: Record<string, any>;
  prerequisites?: string[];
}

/**
 * Template configuration file structure
 */
export interface TemplateConfig {
  engines: Record<string, TemplateEngineConfig>;
  aliases: Record<string, TemplateAlias>;
  settings?: {
    defaultEngine?: string;
    cacheDir?: string;
    timeout?: number;
  };
}

/**
 * Engine configuration in the template config
 */
export interface TemplateEngineConfig {
  command: string;
  defaultArgs: string[];
  timeout?: number;
}

/**
 * Variable extraction context from CUE specs
 */
export interface VariableContext {
  projectName: string;
  serviceName?: string;
  serviceType?: string;
  language?: string;
  ports?: number[];
  environment?: Record<string, string>;
  database?: {
    type: string;
    name: string;
    port?: number;
  };
  [key: string]: any;
}

/**
 * Template manager for handling aliases and execution
 */
export class TemplateManager {
  private config: TemplateConfig | null = null;
  private engines: Map<string, TemplateEngine> = new Map();

  constructor() {
    this.loadDefaultEngines();
  }

  /**
   * Load default template engines
   */
  private loadDefaultEngines(): void {
    // Cookiecutter engine
    this.engines.set("cookiecutter", new CookiecutterEngine());

    // Yeoman engine (future implementation)
    // this.engines.set('yeoman', new YeomanEngine());

    // Custom script engine for simple templates
    this.engines.set("script", new ScriptEngine());
  }

  /**
   * Load template configuration from file system
   */
  async loadConfig(configPath?: string): Promise<void> {
    const defaultPath = await this.getDefaultConfigPath();
    const targetPath = configPath || defaultPath;

    try {
      if (await fs.pathExists(targetPath)) {
        const content = await fs.readJson(targetPath);
        this.config = content;
      } else {
        // Create default config
        this.config = this.getDefaultConfig();
        await this.saveConfig(targetPath);
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Failed to load template config: ${error}`));
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration path
   */
  private async getDefaultConfigPath(): Promise<string> {
    // Look for .arbiter/templates.json first
    const projectPath = path.join(process.cwd(), ".arbiter", "templates.json");
    if (await fs.pathExists(projectPath)) {
      return projectPath;
    }

    // Fall back to global config
    return path.join(os.homedir(), ".arbiter", "templates.json");
  }

  /**
   * Get default template configuration
   */
  private getDefaultConfig(): TemplateConfig {
    return {
      engines: {
        cookiecutter: {
          command: "cookiecutter",
          defaultArgs: ["--no-input"],
          timeout: 300000, // 5 minutes
        },
        script: {
          command: "sh",
          defaultArgs: [],
          timeout: 60000, // 1 minute
        },
      },
      aliases: {
        "bun-hono": {
          engine: "cookiecutter",
          source: "https://github.com/arbiter-templates/bun-hono.git",
          description: "Bun + Hono API service with Drizzle ORM",
        },
        "rust-axum": {
          engine: "cookiecutter",
          source: "gh:arbiter-templates/rust-axum",
          description: "Rust + Axum service with SQLx",
        },
        "react-vite": {
          engine: "cookiecutter",
          source: "/local/path/to/react-template",
          description: "React + Vite frontend with Tailwind",
        },
        "python-fastapi": {
          engine: "cookiecutter",
          source: "https://github.com/fastapi-users/fastapi-users-cookiecutter.git",
          description: "FastAPI service with async SQLAlchemy",
        },
      },
      settings: {
        defaultEngine: "cookiecutter",
        cacheDir: path.join(os.homedir(), ".arbiter", "template-cache"),
        timeout: 300000,
      },
    };
  }

  /**
   * Save configuration to file
   */
  async saveConfig(configPath?: string): Promise<void> {
    if (!this.config) {
      throw new Error("No configuration to save");
    }

    const targetPath = configPath || (await this.getDefaultConfigPath());
    await fs.ensureDir(path.dirname(targetPath));
    await fs.writeJson(targetPath, this.config, { spaces: 2 });
  }

  /**
   * Get all available template aliases
   */
  getAliases(): Record<string, TemplateAlias> {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call loadConfig() first.");
    }
    return this.config.aliases;
  }

  /**
   * Get specific template alias
   */
  getAlias(name: string): TemplateAlias | undefined {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call loadConfig() first.");
    }
    return this.config.aliases[name];
  }

  /**
   * Add or update template alias
   */
  async addAlias(name: string, alias: TemplateAlias): Promise<void> {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call loadConfig() first.");
    }

    // Validate engine exists
    if (!this.engines.has(alias.engine)) {
      throw new Error(`Unknown engine: ${alias.engine}`);
    }

    this.config.aliases[name] = alias;
    await this.saveConfig();
  }

  /**
   * Remove template alias
   */
  async removeAlias(name: string): Promise<void> {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call loadConfig() first.");
    }

    delete this.config.aliases[name];
    await this.saveConfig();
  }

  /**
   * Execute template with variables
   */
  async executeTemplate(
    aliasName: string,
    destination: string,
    variables: VariableContext,
  ): Promise<void> {
    const alias = this.getAlias(aliasName);
    if (!alias) {
      throw new Error(`Template alias '${aliasName}' not found`);
    }

    const engine = this.engines.get(alias.engine);
    if (!engine) {
      throw new Error(`Engine '${alias.engine}' not found`);
    }

    // Merge variables with alias defaults
    const finalVariables = {
      ...alias.variables,
      ...variables,
    };

    // Validate prerequisites if any
    if (alias.prerequisites) {
      await this.validatePrerequisites(alias.prerequisites);
    }

    // Execute template
    await engine.execute(alias.source, destination, finalVariables);
  }

  /**
   * Validate template prerequisites
   */
  private async validatePrerequisites(prerequisites: string[]): Promise<void> {
    for (const prereq of prerequisites) {
      // Simple command existence check
      try {
        await execCommand("which", [prereq]);
      } catch {
        throw new Error(`Prerequisite not found: ${prereq}`);
      }
    }
  }

  /**
   * List available engines
   */
  getEngines(): string[] {
    return Array.from(this.engines.keys());
  }

  /**
   * Add custom engine
   */
  addEngine(engine: TemplateEngine): void {
    this.engines.set(engine.name, engine);
  }
}

/**
 * Cookiecutter template engine implementation
 */
export class CookiecutterEngine implements TemplateEngine {
  name = "cookiecutter";
  command = "cookiecutter";
  defaultArgs = ["--no-input"];

  async validate(source: string): Promise<boolean> {
    try {
      await execCommand("which", ["cookiecutter"]);
      return true;
    } catch {
      return false;
    }
  }

  async execute(
    source: string,
    destination: string,
    variables: Record<string, any>,
  ): Promise<void> {
    try {
      // Build cookiecutter command
      const args = [...this.defaultArgs];

      // Add variables as command line arguments
      for (const [key, value] of Object.entries(variables)) {
        args.push(`--extra-context`);
        args.push(`${key}=${value}`);
      }

      // Add output directory
      args.push("--output-dir", destination);

      // Add template source
      args.push(source);

      await execCommand("cookiecutter", args);
    } catch (error) {
      throw new Error(`Cookiecutter execution failed: ${error}`);
    }
  }
}

/**
 * Simple script-based template engine
 */
export class ScriptEngine implements TemplateEngine {
  name = "script";
  command = "sh";
  defaultArgs = [];

  async validate(source: string): Promise<boolean> {
    return fs.pathExists(source);
  }

  async execute(
    source: string,
    destination: string,
    variables: Record<string, any>,
  ): Promise<void> {
    try {
      // Set variables as environment variables
      const env = {
        ...process.env,
        TEMPLATE_DESTINATION: destination,
        ...Object.fromEntries(
          Object.entries(variables).map(([k, v]) => [`TEMPLATE_${k.toUpperCase()}`, String(v)]),
        ),
      };

      await execCommand("sh", [source], { env });
    } catch (error) {
      throw new Error(`Script execution failed: ${error}`);
    }
  }
}

/**
 * Extract variables from CUE specification content
 */
export function extractVariablesFromCue(content: string, serviceName?: string): VariableContext {
  const variables: VariableContext = {
    projectName: path.basename(process.cwd()).replace(/[^a-zA-Z0-9]/g, ""),
    serviceName: serviceName || "api",
  };

  // Extract project name from package declaration
  const packageMatch = content.match(/package\s+(\w+)/);
  if (packageMatch) {
    variables.projectName = packageMatch[1];
  }

  // Extract service information if service name provided
  if (serviceName) {
    const serviceRegex = new RegExp(`${serviceName}:\\s*{([^}]+)}`, "s");
    const serviceMatch = content.match(serviceRegex);

    if (serviceMatch) {
      const serviceContent = serviceMatch[1];

      // Extract language
      const langMatch = serviceContent.match(/language:\s*"([^"]+)"/);
      if (langMatch) {
        variables.language = langMatch[1];
      }

      // Extract service type
      const typeMatch = serviceContent.match(/serviceType:\s*"([^"]+)"/);
      if (typeMatch) {
        variables.serviceType = typeMatch[1];
      }

      // Extract ports
      const portsMatch = serviceContent.match(/ports:\s*\[([^\]]+)\]/s);
      if (portsMatch) {
        const portsContent = portsMatch[1];
        const portMatches = portsContent.matchAll(/port:\s*(\d+)/g);
        variables.ports = Array.from(portMatches).map((m) => parseInt(m[1], 10));
      }
    }
  }

  return variables;
}

/**
 * Default template manager instance
 */
export const templateManager = new TemplateManager();
