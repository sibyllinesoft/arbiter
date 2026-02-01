/**
 * Plop Template Implementor
 *
 * Uses Plop (Handlebars-based) for template generation.
 * Provides interactive prompts and powerful template transformations.
 *
 * Template resolution:
 * - "template-name"     → Layered lookup: project/.arbiter/templates → ~/.arbiter/templates → builtin
 * - "builtin:name"      → Only look in package built-in templates (no override)
 * - "/absolute/path"    → Use exact path
 * - "./relative/path"   → Use path relative to cwd
 */

import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import nodePlop, { type NodePlopAPI } from "node-plop";
import type { TemplateContext, TemplateImplementor } from "../index.js";

export interface PlopExecuteOptions {
  /** Project directory for layered template lookup */
  projectDir?: string;
  /** Generator name to run (defaults to 'default' or first available) */
  generator?: string;
  /** Force overwrite existing files */
  force?: boolean;
}

/**
 * Get the built-in templates directory (where this package's templates live)
 */
function getBuiltinTemplatesDir(): string {
  // Resolve relative to this module's location
  return path.resolve(import.meta.dirname ?? __dirname, "..", "plopfiles");
}

/**
 * Get layered template search paths (project -> user -> builtin)
 */
function getLayeredSearchPaths(projectDir?: string): string[] {
  const paths: string[] = [];
  const projectRoot = projectDir ?? process.cwd();

  // 1. Project-level (highest priority)
  paths.push(path.join(projectRoot, ".arbiter", "templates", "plopfiles"));

  // 2. User-level
  paths.push(path.join(os.homedir(), ".arbiter", "templates", "plopfiles"));

  // 3. Built-in (lowest priority)
  paths.push(getBuiltinTemplatesDir());

  return paths;
}

/**
 * Plop template implementor with layered template lookup
 */
export class PlopImplementor implements TemplateImplementor {
  name = "plop";
  command = "plop";
  defaultArgs: string[] = [];

  private plopInstance: NodePlopAPI | null = null;
  private projectDir: string | undefined;

  constructor(projectDir?: string) {
    this.projectDir = projectDir;
  }

  /**
   * Set the project directory for layered template lookup
   */
  setProjectDir(dir: string): void {
    this.projectDir = dir;
  }

  async validate(source: string): Promise<boolean> {
    const plopfilePath = await this.resolvePlopfile(source);
    return plopfilePath !== undefined;
  }

  /**
   * Resolve a plopfile from the source string
   *
   * Resolution rules:
   * - "template-name"  → Layered lookup (project → user → builtin)
   * - "builtin:name"   → Only package built-ins
   * - "/absolute/path" → Exact path
   * - "./relative"     → Relative to cwd
   */
  private async resolvePlopfile(source: string): Promise<string | undefined> {
    // Handle builtin: prefix - ONLY look in package built-ins
    if (source.startsWith("builtin:")) {
      const templateName = source.slice(8);
      const builtinDir = getBuiltinTemplatesDir();
      return this.findPlopfileInDir(path.join(builtinDir, templateName));
    }

    // Handle absolute paths
    if (path.isAbsolute(source)) {
      return this.findPlopfileInDir(source);
    }

    // Handle relative paths (starts with ./ or ../)
    if (source.startsWith("./") || source.startsWith("../")) {
      const absolutePath = path.resolve(process.cwd(), source);
      return this.findPlopfileInDir(absolutePath);
    }

    // Default: layered lookup for template names
    const searchPaths = getLayeredSearchPaths(this.projectDir);

    for (const basePath of searchPaths) {
      const templateDir = path.join(basePath, source);
      const plopfile = await this.findPlopfileInDir(templateDir);
      if (plopfile) {
        return plopfile;
      }
    }

    return undefined;
  }

  /**
   * Find a plopfile in a directory (checks .js, .mjs, .cjs extensions)
   */
  private async findPlopfileInDir(dir: string): Promise<string | undefined> {
    // If it's a file, return it directly
    try {
      const stat = await fs.stat(dir);
      if (stat.isFile()) {
        return dir;
      }
    } catch {
      return undefined;
    }

    // Look for plopfile with various extensions
    const extensions = ["plopfile.js", "plopfile.mjs", "plopfile.cjs"];
    for (const ext of extensions) {
      const candidate = path.join(dir, ext);
      if (await fs.pathExists(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  async execute(source: string, destination: string, context: TemplateContext): Promise<void> {
    try {
      const plopfilePath = await this.resolvePlopfile(source);

      if (!plopfilePath) {
        const searchedPaths = source.startsWith("builtin:")
          ? [path.join(getBuiltinTemplatesDir(), source.slice(8))]
          : getLayeredSearchPaths(this.projectDir).map((p) => path.join(p, source));

        throw new Error(
          `Template not found: ${source}\n` + `Searched in:\n  ${searchedPaths.join("\n  ")}`,
        );
      }

      const templateDir = path.dirname(plopfilePath);

      // Load plop with the specified plopfile
      this.plopInstance = await nodePlop(plopfilePath, {
        destBasePath: destination,
        force: false,
      });

      // Set the template directory for relative template file resolution
      this.plopInstance.setPlopfilePath(templateDir);

      // Get the default generator (first one) or 'default' named generator
      const generators = this.plopInstance.getGeneratorList();
      if (generators.length === 0) {
        throw new Error(`No generators found in plopfile: ${plopfilePath}`);
      }

      const generatorName =
        generators.find((g) => g.name === "default")?.name ?? generators[0].name;
      const generator = this.plopInstance.getGenerator(generatorName);

      // Flatten context for plop prompts
      const flatContext = this.flattenContext(context);

      // Run the generator with the provided context (bypassing prompts)
      const results = await generator.runActions(flatContext);

      // Check for failures
      if (results.failures && results.failures.length > 0) {
        const errors = results.failures.map((f) => f.error).join("\n");
        throw new Error(`Plop generation failed:\n${errors}`);
      }
    } catch (error) {
      throw new Error(`Plop execution failed: ${error}`);
    }
  }

  /**
   * Flatten nested context object for plop prompts
   */
  private flattenContext(context: TemplateContext): Record<string, unknown> {
    const flat: Record<string, unknown> = {};

    if (context.project) {
      flat.project = context.project;
      Object.entries(context.project).forEach(([key, value]) => {
        flat[`project_${key}`] = value;
      });
    }

    if (context.artifact) {
      flat.artifact = context.artifact;
      Object.entries(context.artifact).forEach(([key, value]) => {
        flat[key] = value;
        flat[`artifact_${key}`] = value;
      });
    }

    if (context.parent) {
      flat.parent = context.parent;
      Object.entries(context.parent).forEach(([key, value]) => {
        flat[`parent_${key}`] = value;
      });
    }

    if (context.impl) {
      flat.impl = context.impl;
      Object.entries(context.impl).forEach(([key, value]) => {
        flat[`impl_${key}`] = value;
      });
    }

    return flat;
  }
}
