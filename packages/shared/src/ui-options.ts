import path from "node:path";
import { pathToFileURL } from "node:url";
import fs from "fs-extra";

export const ARRAY_UI_OPTION_KEYS = [
  "frontendFrameworks",
  "serviceLanguages",
  "databaseEngines",
  "infrastructureScopes",
] as const;

export const MAP_UI_OPTION_KEYS = ["serviceFrameworks"] as const;

export const UI_OPTION_KEYS = [...ARRAY_UI_OPTION_KEYS, ...MAP_UI_OPTION_KEYS] as const;

export type UIArrayOptionKey = (typeof ARRAY_UI_OPTION_KEYS)[number];
export type UIMapOptionKey = (typeof MAP_UI_OPTION_KEYS)[number];
export type UIOptionKey = (typeof UI_OPTION_KEYS)[number];

export type UIOptionCatalog = {
  frontendFrameworks?: string[];
  serviceLanguages?: string[];
  databaseEngines?: string[];
  infrastructureScopes?: string[];
  serviceFrameworks?: Record<string, string[]>;
};

export const DEFAULT_UI_OPTION_CATALOG: UIOptionCatalog = {
  frontendFrameworks: ["React", "Next.js", "React Native", "Expo", "Flutter"],
  serviceLanguages: ["JavaScript", "TypeScript", "Python", "Go", "Rust"],
  serviceFrameworks: {
    JavaScript: ["Express", "Fastify", "Hapi"],
    TypeScript: ["NestJS", "tRPC", "Fastify"],
    Python: ["FastAPI", "Django", "Flask"],
    Go: ["Gin", "Echo", "Fiber"],
    Rust: ["Actix", "Axum", "Rocket"],
  },
  databaseEngines: ["PostgreSQL", "MySQL", "MariaDB", "MongoDB", "Redis", "SQLite"],
  infrastructureScopes: ["Kubernetes Cluster", "Terraform Stack", "Serverless Platform"],
};

export type UIOptionGeneratorMap = Partial<Record<UIOptionKey, string>>;

export interface UIOptionConfigEntry {
  values?: unknown;
  generator?: string;
}

export type UIOptionConfig = Partial<Record<UIOptionKey, UIOptionConfigEntry>>;

export interface ResolveUIOptionsParams {
  /**
   * Directory to resolve relative generator paths against. Defaults to process.cwd().
   */
  baseDir?: string;
  /**
   * Optional logger callback for informational or warning messages.
   */
  log?: (message: string) => void;
}

export interface ResolveUIOptionsResult {
  catalog: UIOptionCatalog;
  diagnostics: string[];
}

interface GeneratorModule {
  default?: unknown;
  generate?: () => unknown;
  options?: unknown;
}

function normalizeValues(values: unknown): string[] {
  if (!values) return [];
  if (Array.isArray(values)) {
    return values
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0);
  }

  if (typeof values === "string") {
    return values
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  return [];
}

function normalizeFrameworkMap(values: unknown): Record<string, string[]> {
  if (!values || typeof values !== "object") {
    return {};
  }

  const normalized: Record<string, string[]> = {};

  for (const [rawLanguage, rawFrameworks] of Object.entries(values as Record<string, unknown>)) {
    const language = rawLanguage.trim();
    if (!language) continue;

    const frameworks = normalizeValues(rawFrameworks);
    if (frameworks.length === 0) continue;

    normalized[language] = frameworks;
  }

  return normalized;
}

async function executeGenerator(
  generatorPath: string,
  baseDir: string,
  key: UIOptionKey,
): Promise<unknown> {
  const resolvedPath = path.isAbsolute(generatorPath)
    ? generatorPath
    : path.join(baseDir, generatorPath);

  if (!(await fs.pathExists(resolvedPath))) {
    throw new Error(`Generator script not found: ${resolvedPath}`);
  }

  const moduleUrl = pathToFileURL(resolvedPath).href;
  const imported = (await import(moduleUrl)) as GeneratorModule;

  let result: unknown;

  if (typeof imported.generate === "function") {
    result = await imported.generate();
  } else if (typeof imported.default === "function") {
    result = await (imported.default as () => unknown)();
  } else if (Array.isArray(imported.default)) {
    result = imported.default;
  } else if (Array.isArray(imported.options)) {
    result = imported.options;
  } else {
    throw new Error(
      `Generator script for "${key}" must export a function or array (default export, generate())`,
    );
  }

  return result;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      deduped.push(value);
    }
  }
  return deduped;
}

export async function resolveUIOptionCatalog(
  config: UIOptionConfig,
  params: ResolveUIOptionsParams = {},
): Promise<ResolveUIOptionsResult> {
  const catalog: UIOptionCatalog = {};
  const diagnostics: string[] = [];
  const baseDir = params.baseDir || process.cwd();

  for (const key of ARRAY_UI_OPTION_KEYS) {
    const entry = config[key];
    const staticValues = normalizeValues(entry?.values);
    let resolvedValues = [...staticValues];

    if (entry?.generator) {
      try {
        const generated = await executeGenerator(entry.generator, baseDir, key);
        const normalized = normalizeValues(generated);
        if (normalized.length > 0) {
          resolvedValues = normalized;
        } else {
          diagnostics.push(
            `Generator for "${key}" returned no values, falling back to static configuration.`,
          );
        }
      } catch (error) {
        diagnostics.push(
          `Failed to execute generator for "${key}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (resolvedValues.length > 0) {
      (catalog as Record<UIArrayOptionKey, string[]>)[key] = unique(resolvedValues);
    }
  }

  for (const key of MAP_UI_OPTION_KEYS) {
    const entry = config[key];
    const staticMap = normalizeFrameworkMap(entry?.values);
    let resolvedMap = { ...staticMap };

    if (entry?.generator) {
      try {
        const generated = await executeGenerator(entry.generator, baseDir, key);
        const normalized = normalizeFrameworkMap(generated);
        if (Object.keys(normalized).length > 0) {
          resolvedMap = normalized;
        } else {
          diagnostics.push(
            `Generator for "${key}" returned no values, falling back to static configuration.`,
          );
        }
      } catch (error) {
        diagnostics.push(
          `Failed to execute generator for "${key}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (Object.keys(resolvedMap).length > 0) {
      catalog.serviceFrameworks = Object.fromEntries(
        Object.entries(resolvedMap).map(([language, frameworks]) => [language, unique(frameworks)]),
      );
    }
  }

  return { catalog, diagnostics };
}

export function buildUIOptionConfig(
  catalog: UIOptionCatalog | undefined,
  generators: UIOptionGeneratorMap | undefined,
): UIOptionConfig {
  const config: UIOptionConfig = {};

  for (const key of ARRAY_UI_OPTION_KEYS) {
    const values = catalog?.[key];
    const generator = generators?.[key];

    if (values || generator) {
      config[key] = {
        values: values ? [...values] : undefined,
        generator,
      };
    }
  }

  if (catalog?.serviceFrameworks || generators?.serviceFrameworks) {
    config.serviceFrameworks = {
      values: catalog?.serviceFrameworks
        ? Object.fromEntries(
            Object.entries(catalog.serviceFrameworks).map(([language, frameworks]) => [
              language,
              [...frameworks],
            ]),
          )
        : undefined,
      generator: generators?.serviceFrameworks,
    };
  }

  return config;
}
