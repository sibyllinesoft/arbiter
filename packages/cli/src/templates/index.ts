/**
 * Pluggable Template System
 *
 * This module provides a pluggable template system with clean alias configuration
 * that keeps implementation details separate from CUE specifications.
 */

import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { CUEManipulator } from "@/cue/index.js";
import chalk from "chalk";
import fs from "fs-extra";
import { PlopImplementor } from "./plop/index.js";

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
 * Template implementor interface
 */
export interface TemplateImplementor {
  name: string;
  command: string;
  defaultArgs: string[];
  validate?(source: string): Promise<boolean>;
  execute(source: string, destination: string, context: TemplateContext): Promise<void>;
}

/**
 * Template alias configuration
 */
export interface TemplateAlias {
  implementor: string;
  source: string;
  description: string;
  variables?: Record<string, any>;
  prerequisites?: string[];
  /** @deprecated legacy config field */
  engine?: string;
}

/**
 * Template configuration file structure
 */
export interface TemplateConfig {
  implementors: Record<string, TemplateImplementorConfig>;
  aliases: Record<string, TemplateAlias>;
  settings?: {
    defaultImplementor?: string;
    defaultEngine?: string; // legacy
    cacheDir?: string;
    timeout?: number;
  };
}

/**
 * Implementor configuration in the template config
 */
export interface TemplateImplementorConfig {
  command: string;
  defaultArgs: string[];
  timeout?: number;
}

export interface TemplateContext {
  project: Record<string, unknown>;
  parent?: Record<string, unknown>;
  artifact: Record<string, unknown>;
  impl?: Record<string, unknown>;
}

export interface TemplateContextSeed {
  artifactName?: string;
  artifactFallback?: Record<string, unknown>;
  parent?: Record<string, unknown>;
  impl?: Record<string, unknown>;
}

/**
 * Get layered template directories (project -> home -> builtin)
 * Similar to how .env files are resolved
 */
export function getTemplateSearchPaths(projectDir?: string): string[] {
  const paths: string[] = [];

  // 1. Project-level templates (highest priority)
  const projectRoot = projectDir ?? process.cwd();
  paths.push(path.join(projectRoot, ".arbiter", "templates"));

  // 2. User-level templates
  paths.push(path.join(os.homedir(), ".arbiter", "templates"));

  // 3. Built-in templates (lowest priority)
  const builtinPath = path.resolve(import.meta.dirname ?? __dirname, ".");
  paths.push(builtinPath);

  return paths;
}

export interface AvailableTemplate {
  name: string;
  path: string;
  source: "project" | "user" | "builtin";
  hasPlopfile: boolean;
}

/**
 * List all available templates from all layers
 */
export async function listAvailableTemplates(projectDir?: string): Promise<AvailableTemplate[]> {
  const templates: AvailableTemplate[] = [];
  const seen = new Set<string>();

  const projectRoot = projectDir ?? process.cwd();
  const layers: Array<{ path: string; source: "project" | "user" | "builtin" }> = [
    { path: path.join(projectRoot, ".arbiter", "templates", "plopfiles"), source: "project" },
    { path: path.join(os.homedir(), ".arbiter", "templates", "plopfiles"), source: "user" },
    { path: path.resolve(import.meta.dirname ?? __dirname, "plopfiles"), source: "builtin" },
  ];

  for (const layer of layers) {
    try {
      if (await fs.pathExists(layer.path)) {
        const entries = await fs.readdir(layer.path, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !seen.has(entry.name)) {
            seen.add(entry.name);
            const templatePath = path.join(layer.path, entry.name);
            const hasPlopfile =
              (await fs.pathExists(path.join(templatePath, "plopfile.js"))) ||
              (await fs.pathExists(path.join(templatePath, "plopfile.mjs"))) ||
              (await fs.pathExists(path.join(templatePath, "plopfile.cjs")));
            templates.push({
              name: entry.name,
              path: templatePath,
              source: layer.source,
              hasPlopfile,
            });
          }
        }
      }
    } catch (error) {
      // Ignore errors reading directories
    }
  }

  return templates;
}

/**
 * Template orchestrator for handling aliases and execution
 */
export class TemplateOrchestrator {
  private config: TemplateConfig | null = null;
  private implementors: Map<string, TemplateImplementor> = new Map();
  private projectDir: string | undefined;

  constructor(projectDir?: string) {
    this.projectDir = projectDir;
    this.loadDefaultImplementors();
  }

  /**
   * Set the project directory for template resolution
   */
  setProjectDir(dir: string): void {
    this.projectDir = dir;
  }

  /**
   * Load default template implementors
   */
  private loadDefaultImplementors(): void {
    // Plop implementor (default - Handlebars-based)
    this.implementors.set("plop", new PlopImplementor());

    // Cookiecutter implementor (legacy)
    this.implementors.set("cookiecutter", new CookiecutterImplementor());

    // Custom script implementor for simple templates
    this.implementors.set("script", new ScriptImplementor());
  }

  /**
   * Migrate legacy 'engines' field to 'implementors'
   */
  private migrateEnginesField(
    content: TemplateConfig & { engines?: Record<string, TemplateImplementorConfig> },
  ): TemplateConfig {
    if (!content.implementors && content.engines) {
      content.implementors = content.engines;
      delete (content as any).engines;
    }
    return content;
  }

  /**
   * Load config from existing file
   */
  private async loadConfigFromFile(targetPath: string): Promise<void> {
    const content = (await fs.readJson(targetPath)) as TemplateConfig & {
      engines?: Record<string, TemplateImplementorConfig>;
    };
    this.config = this.migrateEnginesField(content);
    this.normalizeLegacyAliasFields();
  }

  /**
   * Create and save default config when none exists
   */
  private async createDefaultConfig(targetPath: string): Promise<void> {
    this.config = this.getDefaultConfig();
    await this.saveConfig(targetPath);
  }

  /**
   * Handle config load failure with fallback to defaults
   */
  private handleConfigLoadError(error: unknown): void {
    console.warn(chalk.yellow(`Warning: Failed to load template config: ${error}`));
    this.config = this.getDefaultConfig();
    this.normalizeLegacyAliasFields();
  }

  /**
   * Load template configuration from file system
   */
  async loadConfig(configPath?: string): Promise<void> {
    const defaultPath = await this.getDefaultConfigPath();
    const targetPath = configPath || defaultPath;

    try {
      if (await fs.pathExists(targetPath)) {
        await this.loadConfigFromFile(targetPath);
      } else {
        await this.createDefaultConfig(targetPath);
      }
    } catch (error) {
      this.handleConfigLoadError(error);
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
      implementors: {
        plop: {
          command: "plop",
          defaultArgs: ["--plopfile"],
          timeout: 120000, // 2 minutes
        },
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
        // Plop-based templates - uses layered lookup (project -> user -> builtin)
        "typescript-service": {
          implementor: "plop",
          source: "typescript-service",
          description: "TypeScript service with Express/Hono",
        },
        "typescript-component": {
          implementor: "plop",
          source: "typescript-component",
          description: "React component with tests",
        },
        "go-service": {
          implementor: "plop",
          source: "go-service",
          description: "Go service with Chi/Echo",
        },
        "python-service": {
          implementor: "plop",
          source: "python-service",
          description: "Python FastAPI service",
        },
        "rust-service": {
          implementor: "plop",
          source: "rust-service",
          description: "Rust Axum service",
        },
        // Legacy cookiecutter templates
        "bun-hono": {
          implementor: "cookiecutter",
          source: "https://github.com/arbiter-templates/bun-hono.git",
          description: "Bun + Hono API service with Drizzle ORM",
        },
        "rust-axum": {
          implementor: "cookiecutter",
          source: "gh:arbiter-templates/rust-axum",
          description: "Rust + Axum service with SQLx",
        },
        "react-vite": {
          implementor: "cookiecutter",
          source: "/local/path/to/react-template",
          description: "React + Vite frontend with Tailwind",
        },
        "python-fastapi": {
          implementor: "cookiecutter",
          source: "https://github.com/fastapi-users/fastapi-users-cookiecutter.git",
          description: "FastAPI service with async SQLAlchemy",
        },
      },
      settings: {
        defaultImplementor: "plop",
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

    // Validate implementor exists
    if (!this.implementors.has(alias.implementor)) {
      throw new Error(`Unknown implementor: ${alias.implementor}`);
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

  async resolveTemplateAsset(
    relativePath: string,
    options: {
      overrideDirectories?: string[];
      defaultDirectories?: string[];
      useLayeredLookup?: boolean;
    } = {},
  ): Promise<{ content: string; resolvedPath: string } | undefined> {
    // Build search paths: overrides -> layered (project/home/builtin) -> explicit defaults
    const searchPaths: string[] = [];

    // 1. Explicit overrides (highest priority)
    searchPaths.push(...this.normalizeAssetDirectories(options.overrideDirectories));

    // 2. Layered lookup (project -> home -> builtin) if enabled (default: true)
    if (options.useLayeredLookup !== false) {
      searchPaths.push(...getTemplateSearchPaths(this.projectDir));
    }

    // 3. Explicit defaults (lowest priority)
    searchPaths.push(...this.normalizeAssetDirectories(options.defaultDirectories));

    for (const baseDir of searchPaths) {
      const candidatePath = path.resolve(baseDir, relativePath);
      try {
        if (await fs.pathExists(candidatePath)) {
          const content = await fs.readFile(candidatePath, "utf-8");
          return { content, resolvedPath: candidatePath };
        }
      } catch {}
    }

    return undefined;
  }

  private normalizeAssetDirectories(directories?: string[]): string[] {
    if (!Array.isArray(directories)) return [];
    const normalized = directories
      .map((dir) => (typeof dir === "string" ? dir.trim() : ""))
      .filter((dir): dir is string => dir.length > 0)
      .map((dir) => path.resolve(dir));
    return Array.from(new Set(normalized));
  }

  /**
   * Execute template with variables
   */
  async executeTemplate(
    aliasName: string,
    destination: string,
    context: TemplateContext,
  ): Promise<void> {
    const alias = this.getAlias(aliasName);
    if (!alias) {
      throw new Error(`Template alias '${aliasName}' not found`);
    }

    const implementor = this.implementors.get(alias.implementor);
    if (!implementor) {
      throw new Error(`Implementor '${alias.implementor}' not found`);
    }

    const mergedImpl = {
      ...(context.impl ?? {}),
      ...(alias.variables ?? {}),
    };
    const finalContext: TemplateContext = {
      project: context.project,
      parent: context.parent,
      artifact: context.artifact,
      impl: Object.keys(mergedImpl).length > 0 ? mergedImpl : undefined,
    };

    // Validate prerequisites if any
    if (alias.prerequisites) {
      await this.validatePrerequisites(alias.prerequisites);
    }

    // Execute template
    await implementor.execute(alias.source, destination, finalContext);
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
   * List available implementors
   */
  getImplementors(): string[] {
    return Array.from(this.implementors.keys());
  }

  /**
   * Add custom implementor
   */
  addImplementor(implementor: TemplateImplementor): void {
    this.implementors.set(implementor.name, implementor);
  }

  private migrateAliasEngineToImplementor(alias: TemplateAlias): void {
    if (!alias.implementor && (alias as any).engine) {
      alias.implementor = (alias as any).engine;
      delete (alias as any).engine;
    }
  }

  private migrateSettingsDefaultEngine(): void {
    const settings = this.config?.settings;
    if (settings && !settings.defaultImplementor && settings.defaultEngine) {
      settings.defaultImplementor = settings.defaultEngine;
    }
  }

  private normalizeLegacyAliasFields(): void {
    if (!this.config) return;
    Object.values(this.config.aliases).forEach((alias) =>
      this.migrateAliasEngineToImplementor(alias),
    );
    this.migrateSettingsDefaultEngine();
  }
}

/**
 * Cookiecutter template implementor implementation
 */
export class CookiecutterImplementor implements TemplateImplementor {
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

  async execute(source: string, destination: string, context: TemplateContext): Promise<void> {
    try {
      // Build cookiecutter command
      const args = [...this.defaultArgs];

      // Add template context as a single JSON payload
      args.push("--extra-context");
      args.push(JSON.stringify(context));

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
 * Simple script-based template implementor
 */
export class ScriptImplementor implements TemplateImplementor {
  name = "script";
  command = "sh";
  defaultArgs = [];

  async validate(source: string): Promise<boolean> {
    return fs.pathExists(source);
  }

  async execute(source: string, destination: string, context: TemplateContext): Promise<void> {
    try {
      // Set variables as environment variables
      const env = {
        ...process.env,
        TEMPLATE_DESTINATION: destination,
        TEMPLATE_CONTEXT: JSON.stringify(context),
      };

      await execCommand("sh", [source], { env });
    } catch (error) {
      throw new Error(`Script execution failed: ${error}`);
    }
  }
}

/**
 * Build a template context from raw CUE content
 */
export async function buildTemplateContext(
  content: string,
  seed?: TemplateContextSeed,
): Promise<TemplateContext> {
  const manipulator = new CUEManipulator();
  let project: Record<string, unknown> = {};
  try {
    project = (await manipulator.parse(content)) ?? {};
  } catch (error) {
    project = {
      _error: error instanceof Error ? error.message : String(error),
      raw: content,
    };
  }

  const { artifact, parent } = resolveArtifact(project, seed);
  const impl = seed?.impl ? { ...seed.impl } : undefined;

  return {
    project,
    parent,
    artifact,
    impl,
  };
}

function resolveArtifact(
  project: Record<string, unknown>,
  seed?: TemplateContextSeed,
): { artifact: Record<string, unknown>; parent?: Record<string, unknown> } {
  if (!seed) {
    return { artifact: project };
  }

  if (seed.artifactName) {
    const match = findArtifactByName(project, seed.artifactName);
    if (match) {
      return match;
    }
  }

  if (seed.artifactFallback) {
    return { artifact: { ...seed.artifactFallback } };
  }

  return { artifact: project };
}

function findArtifactByName(
  project: Record<string, unknown>,
  name: string,
): { artifact: Record<string, unknown>; parent?: Record<string, unknown> } | undefined {
  const sections = ["services", "clients", "databases", "components"];
  for (const section of sections) {
    const bucket = project[section];
    if (bucket && typeof bucket === "object" && name in (bucket as Record<string, unknown>)) {
      const parent = bucket as Record<string, unknown>;
      const node = parent[name] as Record<string, unknown>;
      return {
        artifact: { name, ...node },
        parent,
      };
    }
  }

  return undefined;
}

/**
 * Default template orchestrator instance
 */
export const templateOrchestrator = new TemplateOrchestrator();

// Re-export Plop utilities
export { PlopImplementor, type PlopExecuteOptions } from "./plop/index.js";
export {
  renderTemplate,
  compileTemplate,
  registerPartial,
  registerHelper,
  Handlebars,
} from "./plop/handlebars-renderer.js";
