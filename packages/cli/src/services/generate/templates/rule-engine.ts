/**
 * @packageDocumentation
 * Rule-engine-based module selection for service generation.
 *
 * Replaces ad-hoc if/else chains with a declarative `json-rules-engine` system.
 * Each plop module declares a colocated `rules.json`. Given artifact metadata,
 * **all** matching rules fire, accumulating multiple module contributions that
 * are composed together.
 */

import path from "node:path";
import type { ServiceGenerationTarget } from "@/services/generate/io/contexts.js";
import type { PackageConfig } from "@arbiter/specification";
import fs from "fs-extra";
import { Engine } from "json-rules-engine";

import {
  MODULES_BASE_PATH,
  type ModuleCategory,
  loadModuleMetadata,
  renderModuleTemplates,
} from "./module-loader.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Facts derived from an artifact's metadata and passed to the rule engine.
 */
export interface ModuleSelectionFacts {
  language: string;
  framework: string;
  subtype: string;
  tags: string[];
  parent: string;
  database: string;
  port: number;
  name: string;
  artifactType: string;
}

/**
 * A single rule definition loaded from a module's `rules.json`.
 */
export interface ModuleRuleDefinition {
  name: string;
  priority: number;
  conditions: Record<string, unknown>;
  event: {
    type: string;
    params: {
      category: string;
      module: string;
    };
  };
}

/**
 * A matched module returned by the rule engine.
 */
export interface ModuleMatch {
  category: ModuleCategory;
  module: string;
  priority: number;
  ruleName: string;
}

/**
 * Result of composing all matched modules together.
 */
export interface ComposedModuleResult {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  envVars: Record<string, string>;
  files: Array<{ path: string; content: string }>;
  modules: string[];
}

// ---------------------------------------------------------------------------
// Custom operators
// ---------------------------------------------------------------------------

/**
 * `contains` — true when the fact string contains the value as a substring.
 * Handles null/undefined facts gracefully.
 */
function containsOperator(factValue: unknown, jsonValue: unknown): boolean {
  if (typeof factValue !== "string" || typeof jsonValue !== "string") return false;
  return factValue.toLowerCase().includes(jsonValue.toLowerCase());
}

/**
 * `hasTag` — true when the fact (string[]) includes the given value.
 */
function hasTagOperator(factValue: unknown, jsonValue: unknown): boolean {
  if (!Array.isArray(factValue) || typeof jsonValue !== "string") return false;
  return factValue.some(
    (tag) => typeof tag === "string" && tag.toLowerCase() === jsonValue.toLowerCase(),
  );
}

// ---------------------------------------------------------------------------
// Engine cache
// ---------------------------------------------------------------------------

let cachedEngine: Engine | null = null;
let cachedRules: ModuleRuleDefinition[] | null = null;

/**
 * Clear the cached engine instance (useful for tests).
 */
export function clearEngineCache(): void {
  cachedEngine = null;
  cachedRules = null;
}

// ---------------------------------------------------------------------------
// Rule discovery
// ---------------------------------------------------------------------------

const ALL_CATEGORIES: ModuleCategory[] = [
  "backends",
  "frontends",
  "databases",
  "infra",
  "desktop",
  "mobile",
  "cloud",
  "build",
  "docs",
  "quality",
  "storybook",
];

/**
 * Discover all `rules.json` files across module categories.
 */
async function discoverRules(): Promise<ModuleRuleDefinition[]> {
  if (cachedRules) return cachedRules;

  const rules: ModuleRuleDefinition[] = [];

  for (const category of ALL_CATEGORIES) {
    const categoryPath = path.join(MODULES_BASE_PATH, category);
    if (!(await fs.pathExists(categoryPath))) continue;

    const entries = await fs.readdir(categoryPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

      const rulesPath = path.join(categoryPath, entry.name, "rules.json");
      if (await fs.pathExists(rulesPath)) {
        try {
          const raw = await fs.readJson(rulesPath);
          rules.push(raw as ModuleRuleDefinition);
        } catch {
          // Skip malformed rules.json — module stays invisible to engine
        }
      }
    }
  }

  cachedRules = rules;
  return rules;
}

// ---------------------------------------------------------------------------
// Engine setup
// ---------------------------------------------------------------------------

/**
 * Build (or return cached) `json-rules-engine` Engine with all discovered rules.
 */
async function getEngine(): Promise<Engine> {
  if (cachedEngine) return cachedEngine;

  const engine = new Engine([], { allowUndefinedFacts: true });

  // Register custom operators
  engine.addOperator("contains", containsOperator);
  engine.addOperator("hasTag", hasTagOperator);

  // Load all rules
  const rules = await discoverRules();
  for (const rule of rules) {
    engine.addRule({
      name: rule.name,
      priority: rule.priority,
      conditions: rule.conditions as any,
      event: rule.event as any,
    });
  }

  cachedEngine = engine;
  return engine;
}

// ---------------------------------------------------------------------------
// Facts builder
// ---------------------------------------------------------------------------

/**
 * Assemble `ModuleSelectionFacts` from a `ServiceGenerationTarget`.
 */
export function buildFacts(target: ServiceGenerationTarget): ModuleSelectionFacts {
  const config = target.config as PackageConfig & Record<string, unknown>;

  // Resolve nested vs flat config shapes
  const service = (config.service as Record<string, unknown>) ?? {};
  const language = (target.language ?? config.language ?? "").toLowerCase();
  const framework = ((service.framework as string) ?? config.framework ?? "")
    .toString()
    .toLowerCase();
  const subtype = ((config.subtype as string) ?? "service").toLowerCase();
  const tags: string[] = (config.tags as string[]) ?? [];
  const parent = ((config.parent as string) ?? "").toLowerCase();
  const database = ((config.database as string) ?? (config.metadata?.database as string) ?? "")
    .toString()
    .toLowerCase();
  const port = (config.port as number) ?? 3000;
  const name = config.name ?? target.slug ?? "";

  return {
    language,
    framework,
    subtype,
    tags,
    parent,
    database,
    port,
    name,
    artifactType: "service",
  };
}

// ---------------------------------------------------------------------------
// Module selection
// ---------------------------------------------------------------------------

/**
 * Run the rule engine against the given facts and return ALL matching modules,
 * sorted by descending priority.
 */
export async function selectModules(facts: ModuleSelectionFacts): Promise<ModuleMatch[]> {
  const engine = await getEngine();
  const { events } = await engine.run(facts);

  const matches: ModuleMatch[] = events
    .filter((e) => e.type === "module-match" && e.params)
    .map((e) => ({
      category: e.params!.category as ModuleCategory,
      module: e.params!.module as string,
      priority: (e.params!.priority as number) ?? 0,
      ruleName: (e.params!.ruleName as string) ?? `${e.params!.category}/${e.params!.module}`,
    }));

  // Sort descending by priority — highest priority first
  matches.sort((a, b) => b.priority - a.priority);
  return matches;
}

// ---------------------------------------------------------------------------
// Module composition
// ---------------------------------------------------------------------------

/**
 * Load, render, and merge all matched modules into a single composed result.
 *
 * - Dependencies, devDependencies, scripts, and envVars are merged (later modules
 *   override earlier ones for duplicate keys — but higher-priority modules run first).
 * - Template files use first-writer-wins: if two modules emit the same output path,
 *   the higher-priority module's version is kept.
 */
export async function composeMatchedModules(
  matches: ModuleMatch[],
  templateData: Record<string, unknown>,
): Promise<ComposedModuleResult> {
  const result: ComposedModuleResult = {
    dependencies: {},
    devDependencies: {},
    scripts: {},
    envVars: {},
    files: [],
    modules: [],
  };

  const seenFilePaths = new Set<string>();

  for (const match of matches) {
    const category = match.category as ModuleCategory;
    const moduleName = match.module;

    try {
      // Load metadata (dependencies, scripts, envVars)
      const metadata = await loadModuleMetadata(category, moduleName);
      Object.assign(result.dependencies, metadata.dependencies ?? {});
      Object.assign(result.devDependencies, metadata.devDependencies ?? {});
      Object.assign(result.scripts, metadata.scripts ?? {});
      Object.assign(result.envVars, metadata.envVars ?? {});

      // Render templates
      const rendered = await renderModuleTemplates(category, moduleName, templateData);
      for (const file of rendered) {
        // First-writer-wins: highest priority already processed first
        if (!seenFilePaths.has(file.path)) {
          seenFilePaths.add(file.path);
          result.files.push(file);
        }
      }

      result.modules.push(`${category}/${moduleName}`);
    } catch (err: any) {
      // Log but don't fail — skip broken modules gracefully
      console.warn(`Rule engine: failed to load module ${category}/${moduleName}: ${err.message}`);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Language/framework support check
// ---------------------------------------------------------------------------

/**
 * Check if a backend module supports the given language/framework combination.
 *
 * This is data-driven: it runs the rule engine with test facts and checks if
 * any backend module matches, rather than hardcoding framework/language pairs.
 */
export async function supportsLanguage(framework: string, language: string): Promise<boolean> {
  const facts: ModuleSelectionFacts = {
    language: language.toLowerCase(),
    framework: framework.toLowerCase(),
    subtype: "service",
    tags: [],
    parent: "",
    database: "",
    port: 3000,
    name: "test",
    artifactType: "service",
  };

  const matches = await selectModules(facts);
  return matches.some((m) => m.category === "backends");
}
