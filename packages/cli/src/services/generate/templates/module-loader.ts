/**
 * @packageDocumentation
 * Shared template module loader for plop templates.
 *
 * Provides utilities to load and render templates from the plop module system,
 * enabling reuse between `init` and `generate` commands.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import Handlebars from "handlebars";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the base path to plop template modules.
 * Handles both development (running from src) and production (bundled to dist).
 */
function resolveModulesBasePath(): string {
  // Try development path first (src/services/generate/templates -> src/templates/plopfiles/_modules)
  const devPath = path.resolve(__dirname, "../../templates/plopfiles/_modules");
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  // Try bundled path (dist/cli.js -> dist/templates/plopfiles/_modules)
  // When bundled, __dirname might be the bundle location, so try relative to process.cwd()
  const distPath = path.resolve(path.dirname(__filename), "templates/plopfiles/_modules");
  if (fs.existsSync(distPath)) {
    return distPath;
  }

  // Try relative to the CLI executable
  const cliDir = path.dirname(process.argv[1] || __filename);
  const cliRelativePath = path.resolve(cliDir, "templates/plopfiles/_modules");
  if (fs.existsSync(cliRelativePath)) {
    return cliRelativePath;
  }

  // Fallback: try finding it via package resolution
  // This handles cases where the CLI is installed globally
  try {
    const packageRoot = path.resolve(require.resolve("@arbiter/cli/package.json"), "..");
    const packagePath = path.join(packageRoot, "dist/templates/plopfiles/_modules");
    if (fs.existsSync(packagePath)) {
      return packagePath;
    }
  } catch {
    // Package resolution failed, continue with fallback
  }

  // Final fallback: use the development path even if it doesn't exist
  // (will fail later with a clear error message)
  return devPath;
}

/**
 * Base path to plop template modules
 */
export const MODULES_BASE_PATH = resolveModulesBasePath();

/**
 * Template module metadata exported by plop modules
 */
export interface TemplateModuleMetadata {
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  envVars?: Record<string, string>;
}

/**
 * Available backend module names
 */
export type BackendModule =
  | "node-hono"
  | "node-express"
  | "node-fastify"
  | "python-fastapi"
  | "rust-axum"
  | "go-chi"
  | "kotlin-ktor";

/**
 * Available frontend module names
 */
export type FrontendModule = "react-vite" | "vue-vite" | "solid-vite";

/**
 * Module categories
 */
export type ModuleCategory =
  | "backends"
  | "frontends"
  | "databases"
  | "infra"
  | "desktop"
  | "mobile";

/**
 * Get the path to a template module
 */
export function getModulePath(category: ModuleCategory, name: string): string {
  return path.join(MODULES_BASE_PATH, category, name);
}

/**
 * Get the path to a template module's templates directory
 */
export function getModuleTemplatesPath(category: ModuleCategory, name: string): string {
  return path.join(getModulePath(category, name), "templates");
}

/**
 * Check if a template module exists
 */
export async function moduleExists(category: ModuleCategory, name: string): Promise<boolean> {
  const modulePath = path.join(getModulePath(category, name), "module.js");
  return fs.pathExists(modulePath);
}

/**
 * Load a template module's metadata (dependencies, scripts, etc.)
 */
export async function loadModuleMetadata(
  category: ModuleCategory,
  name: string,
): Promise<TemplateModuleMetadata> {
  const modulePath = path.join(getModulePath(category, name), "module.js");

  if (!(await fs.pathExists(modulePath))) {
    throw new Error(`Module not found: ${category}/${name} (looked in ${modulePath})`);
  }

  const mod = await import(modulePath);

  return {
    description: mod.description,
    dependencies: mod.dependencies,
    devDependencies: mod.devDependencies,
    scripts: mod.scripts,
    envVars: mod.envVars,
  };
}

/**
 * Register common Handlebars helpers used by plop templates
 */
function registerHandlebarsHelpers(): void {
  // JSON helper for serializing objects (used for routes)
  if (!Handlebars.helpers.json) {
    Handlebars.registerHelper("json", (context: unknown) => {
      return JSON.stringify(context, null, 2);
    });
  }

  if (!Handlebars.helpers.pascalCase) {
    Handlebars.registerHelper("pascalCase", (str: string) => {
      if (!str) return "";
      return str
        .split(/[-_\s]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("");
    });
  }

  if (!Handlebars.helpers.camelCase) {
    Handlebars.registerHelper("camelCase", (str: string) => {
      if (!str) return "";
      const pascal = str
        .split(/[-_\s]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("");
      return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    });
  }

  if (!Handlebars.helpers.kebabCase) {
    Handlebars.registerHelper("kebabCase", (str: string) => {
      if (!str) return "";
      return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();
    });
  }

  if (!Handlebars.helpers.titleCase) {
    Handlebars.registerHelper("titleCase", (str: string) => {
      if (!str) return "";
      return str
        .split(/[-_\s]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    });
  }

  if (!Handlebars.helpers.snakeCase) {
    Handlebars.registerHelper("snakeCase", (str: string) => {
      if (!str) return "";
      return str
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/[\s-]+/g, "_")
        .toLowerCase();
    });
  }

  if (!Handlebars.helpers.upperCase) {
    Handlebars.registerHelper("upperCase", (str: string) => {
      if (!str) return "";
      return str.toUpperCase();
    });
  }

  if (!Handlebars.helpers.lowerCase) {
    Handlebars.registerHelper("lowerCase", (str: string) => {
      if (!str) return "";
      return str.toLowerCase();
    });
  }
}

/**
 * Render a single Handlebars template file
 */
export async function renderTemplate(
  templatePath: string,
  data: Record<string, unknown>,
): Promise<string> {
  registerHandlebarsHelpers();

  const templateContent = await fs.readFile(templatePath, "utf-8");
  const template = Handlebars.compile(templateContent);
  return template(data);
}

/**
 * Render a template from a module by relative path
 */
export async function renderModuleTemplate(
  category: ModuleCategory,
  moduleName: string,
  templateRelativePath: string,
  data: Record<string, unknown>,
): Promise<string> {
  const templatesPath = getModuleTemplatesPath(category, moduleName);
  const templatePath = path.join(templatesPath, templateRelativePath);

  if (!(await fs.pathExists(templatePath))) {
    throw new Error(`Template not found: ${templateRelativePath} in ${category}/${moduleName}`);
  }

  return renderTemplate(templatePath, data);
}

/**
 * List all template files in a module
 */
export async function listModuleTemplates(
  category: ModuleCategory,
  name: string,
): Promise<string[]> {
  const templatesPath = getModuleTemplatesPath(category, name);

  if (!(await fs.pathExists(templatesPath))) {
    return [];
  }

  const files: string[] = [];

  async function walkDir(dir: string, relativePath = ""): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        await walkDir(fullPath, relPath);
      } else if (entry.name.endsWith(".hbs")) {
        files.push(relPath);
      }
    }
  }

  await walkDir(templatesPath);
  return files;
}

/**
 * Render all templates in a module and return file contents
 */
export async function renderModuleTemplates(
  category: ModuleCategory,
  moduleName: string,
  data: Record<string, unknown>,
): Promise<Array<{ path: string; content: string }>> {
  const templates = await listModuleTemplates(category, moduleName);
  const results: Array<{ path: string; content: string }> = [];

  for (const templateFile of templates) {
    const content = await renderModuleTemplate(category, moduleName, templateFile, data);
    // Remove .hbs extension from output path
    const outputPath = templateFile.replace(/\.hbs$/, "");
    results.push({ path: outputPath, content });
  }

  return results;
}

/**
 * Map framework name to module name
 */
export function frameworkToModule(framework: string, language = "typescript"): string | null {
  const normalized = framework.toLowerCase();

  // TypeScript/Node backends
  if (language === "typescript" || language === "javascript") {
    if (normalized.includes("hono")) return "node-hono";
    if (normalized.includes("express")) return "node-express";
    if (normalized.includes("fastify")) return "node-fastify";
  }

  // Python backends
  if (language === "python") {
    if (normalized.includes("fastapi")) return "python-fastapi";
    if (normalized.includes("flask")) return "python-flask";
  }

  // Rust backends
  if (language === "rust") {
    if (normalized.includes("axum")) return "rust-axum";
    if (normalized.includes("actix")) return "rust-actix";
  }

  // Go backends
  if (language === "go") {
    if (normalized.includes("chi")) return "go-chi";
    if (normalized.includes("gin")) return "go-gin";
  }

  // Kotlin backends
  if (language === "kotlin") {
    if (normalized.includes("ktor")) return "kotlin-ktor";
  }

  return null;
}

/**
 * Get available modules for a category
 */
export async function getAvailableModules(category: ModuleCategory): Promise<string[]> {
  const categoryPath = path.join(MODULES_BASE_PATH, category);

  if (!(await fs.pathExists(categoryPath))) {
    return [];
  }

  const entries = await fs.readdir(categoryPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}
