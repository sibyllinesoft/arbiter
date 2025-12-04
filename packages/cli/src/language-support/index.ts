/**
 * Language Plugin System for Arbiter CLI
 * Provides pluggable code generation for multiple programming languages
 */

import type { AppSpec } from "@arbiter/shared";

// Core types for the plugin system
export interface ComponentProp {
  name: string;
  type: string;
  required: boolean;
}

export interface ComponentConfig {
  name: string;
  type: "page" | "component" | "layout" | "hook" | "util";
  props?: ComponentProp[];
  dependencies?: string[];
  styles?: boolean;
  tests?: boolean;
  testId?: string;
}

export interface ServiceConfig {
  name: string;
  type: "api" | "service" | "handler" | "middleware" | "model";
  endpoints?: string[];
  database?: boolean;
  auth?: boolean;
  validation?: boolean;
  methods?: Array<Record<string, any>>;
}

export interface ProjectConfig {
  name: string;
  description?: string;
  features: string[];
  database?: "sqlite" | "postgres" | "mysql" | "mongodb";
  auth?: "jwt" | "session" | "oauth";
  testing?: boolean;
  docker?: boolean;
}

export interface BuildConfig {
  target: "development" | "production" | "test";
  optimization?: boolean;
  bundling?: boolean;
  typeChecking?: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
  executable?: boolean;
}

export interface LanguagePluginConfigureOptions {
  templateOverrides?: string[];
  pluginConfig?: Record<string, unknown>;
  workspaceRoot?: string;
  testing?: LanguageTestingConfig;
}

export interface GenerationResult {
  files: GeneratedFile[];
  instructions?: string[];
  dependencies?: string[];
  scripts?: Record<string, string>;
}

export interface LanguageTestingConfig {
  framework?: string;
  outputDir?: string;
  command?: string;
  options?: Record<string, unknown>;
}

export interface EndpointAssertionDefinition {
  name: string;
  result: boolean | null;
  severity: "error" | "warn" | "info";
  message?: string;
  tags?: string[];
  raw?: unknown;
}

export interface EndpointTestCaseDefinition {
  path: string;
  method: string;
  assertions: EndpointAssertionDefinition[];
  status?: number;
  metadata?: Record<string, unknown>;
}

export interface EndpointTestGenerationConfig {
  app: AppSpec;
  cases: EndpointTestCaseDefinition[];
  outputDir: string;
  relativeDir: string;
  language: string;
  testing?: LanguageTestingConfig;
}

export interface LanguagePluginCapabilities {
  components?: boolean;
  services?: boolean;
  testing?: boolean;
  api?: boolean;
  infrastructure?: boolean;
  [capability: string]: boolean | undefined;
}

// Main plugin interface
export interface LanguagePlugin {
  readonly name: string;
  readonly language: string;
  readonly version: string;
  readonly description: string;
  readonly supportedFeatures: string[];
  readonly capabilities?: LanguagePluginCapabilities;

  configure?(options: LanguagePluginConfigureOptions): void;

  // Component generation (primarily for frontend languages)
  generateComponent?(config: ComponentConfig): Promise<GenerationResult>;

  // Service/API scaffolding
  generateService(config: ServiceConfig): Promise<GenerationResult>;

  // Project structure setup
  initializeProject(config: ProjectConfig): Promise<GenerationResult>;

  // Build configuration
  generateBuildConfig(config: BuildConfig): Promise<GenerationResult>;

  // Language-specific utilities
  validateConfig?(config: any): Promise<boolean>;
  getTemplates?(): string[];
  getDependencies?(features: string[]): string[];

  // Optional endpoint assertion test generation
  generateEndpointTests?(config: EndpointTestGenerationConfig): Promise<GenerationResult>;
}

export interface ComponentLanguagePlugin extends LanguagePlugin {
  capabilities: LanguagePluginCapabilities & { components: true };
  generateComponent(config: ComponentConfig): Promise<GenerationResult>;
}

export interface ServiceLanguagePlugin extends LanguagePlugin {
  capabilities: LanguagePluginCapabilities & { services: true };
  generateService(config: ServiceConfig): Promise<GenerationResult>;
}

// Plugin registry
export class LanguageRegistry {
  private plugins = new Map<string, LanguagePlugin>();

  register(plugin: LanguagePlugin): void {
    this.plugins.set(plugin.language.toLowerCase(), plugin);
  }

  configure(language: string, options: LanguagePluginConfigureOptions): void {
    const plugin = this.plugins.get(language.toLowerCase());
    if (plugin?.configure) {
      plugin.configure(options);
    }
  }

  get(language: string): LanguagePlugin | undefined {
    return this.plugins.get(language.toLowerCase());
  }

  list(): LanguagePlugin[] {
    return Array.from(this.plugins.values());
  }

  getSupportedLanguages(): string[] {
    return Array.from(this.plugins.keys());
  }

  hasSupport(language: string, feature: string): boolean {
    const plugin = this.get(language);
    return plugin?.supportedFeatures.includes(feature) ?? false;
  }
}

// Global registry instance
export const registry = new LanguageRegistry();

// Plugin registration helper
export function registerPlugin(plugin: LanguagePlugin): void {
  registry.register(plugin);
}

// Convenience functions
export async function generateComponent(
  language: string,
  config: ComponentConfig,
): Promise<GenerationResult> {
  const plugin = registry.get(language);
  if (!plugin) {
    throw new Error(`No plugin found for language: ${language}`);
  }

  if (!isComponentPlugin(plugin)) {
    throw new Error(`Component generation not supported for language: ${language}`);
  }

  return plugin.generateComponent(config);
}

export async function generateService(
  language: string,
  config: ServiceConfig,
): Promise<GenerationResult> {
  const plugin = registry.get(language);
  if (!plugin) {
    throw new Error(`No plugin found for language: ${language}`);
  }

  return plugin.generateService(config);
}

function isComponentPlugin(plugin: LanguagePlugin): plugin is ComponentLanguagePlugin {
  return Boolean(plugin.capabilities?.components && typeof plugin.generateComponent === "function");
}

export async function initializeProject(
  language: string,
  config: ProjectConfig,
): Promise<GenerationResult> {
  const plugin = registry.get(language);
  if (!plugin) {
    throw new Error(`No plugin found for language: ${language}`);
  }

  return plugin.initializeProject(config);
}

export async function generateBuildConfig(
  language: string,
  config: BuildConfig,
): Promise<GenerationResult> {
  const plugin = registry.get(language);
  if (!plugin) {
    throw new Error(`No plugin found for language: ${language}`);
  }

  return plugin.generateBuildConfig(config);
}

import { GoPlugin } from "@/language-support/go.js";
import { PythonPlugin } from "@/language-support/python.js";
import { RustPlugin } from "@/language-support/rust.js";
// Import and register all plugins
import { TypeScriptPlugin } from "@/language-support/typescript.js";

// Auto-register plugins
registerPlugin(new TypeScriptPlugin());
registerPlugin(new PythonPlugin());
registerPlugin(new GoPlugin());
registerPlugin(new RustPlugin());

// Export plugin instances for direct access
export { TypeScriptPlugin, PythonPlugin, GoPlugin, RustPlugin };
