/**
 * @packageDocumentation
 * Service scaffolding generator using plop templates.
 *
 * Generates service code using the rule engine to select and compose
 * multiple template modules based on artifact metadata.
 */

import path from "node:path";
import type { ServiceGenerationTarget } from "@/services/generate/io/contexts.js";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import {
  type ComposedModuleResult,
  buildFacts,
  composeMatchedModules,
  selectModules,
  supportsLanguage,
} from "./rule-engine.js";

export { supportsLanguage };

/**
 * Framework types supported by the service generator
 */
export type ServiceFramework = "fastify" | "hono" | "express";

/**
 * Route binding for service endpoints
 */
export interface RouteBinding {
  method: string;
  url: string;
  summary?: string;
  reply?: unknown;
  statusCode?: number;
}

/**
 * Service generation data passed to templates
 */
export interface ServiceTemplateData {
  name: string;
  port: number;
  routes: RouteBinding[];
  framework?: string;
}

/**
 * Detect framework from service config.
 * Handles both nested (config.service.framework) and flat (config.framework) structures.
 */
export function detectFramework(config: Record<string, unknown>): ServiceFramework {
  const service = config.service as Record<string, unknown> | undefined;
  let framework = (service?.framework as string)?.toLowerCase() ?? "";

  if (!framework) {
    framework = (config.framework as string)?.toLowerCase() ?? "";
  }

  if (framework.includes("hono")) return "hono";
  if (framework.includes("express")) return "express";
  return "fastify";
}

/**
 * Convert OpenAPI path parameter syntax {param} to framework syntax :param
 */
function convertPathParams(url: string): string {
  return url.replace(/\{([^}]+)\}/g, ":$1");
}

/**
 * Prepare routes for template rendering
 */
function prepareRoutes(routes: RouteBinding[]): RouteBinding[] {
  return routes.map((route) => ({
    ...route,
    url: convertPathParams(route.url),
  }));
}

/**
 * Generate a service using the rule engine to select and compose modules.
 *
 * The rule engine evaluates all `rules.json` files against the artifact's
 * metadata. ALL matching rules fire, accumulating multiple module contributions
 * (e.g., backend + quality + infra) that are composed together.
 */
export async function generateServiceFromTemplate(
  target: ServiceGenerationTarget,
  data: ServiceTemplateData,
  options: GenerateOptions,
): Promise<string[]> {
  const facts = buildFacts(target);
  const matches = await selectModules(facts);

  if (matches.length === 0) {
    throw new Error(
      `No modules matched for: language=${facts.language}, framework=${facts.framework}, subtype=${facts.subtype}`,
    );
  }

  const framework = detectFramework(target.config as Record<string, unknown>);
  const templateData: Record<string, unknown> = {
    name: data.name,
    port: data.port,
    routes: prepareRoutes(data.routes),
    framework,
  };

  const composed = await composeMatchedModules(matches, templateData);
  return await writeComposedOutput(target, data, composed, options);
}

/**
 * Write all composed module output to disk.
 */
async function writeComposedOutput(
  target: ServiceGenerationTarget,
  data: ServiceTemplateData,
  composed: ComposedModuleResult,
  options: GenerateOptions,
): Promise<string[]> {
  const outputDir = target.context.root;
  const files: string[] = [];

  await ensureDirectory(outputDir, options);

  const packageJson: Record<string, unknown> = {
    name: data.name,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "tsx watch src/index.ts",
      start: "node dist/index.js",
      build: "tsc -p tsconfig.json",
      test: "vitest run --passWithNoTests",
      ...composed.scripts,
    },
    dependencies: composed.dependencies,
    devDependencies: {
      "@types/node": "^20.0.0",
      typescript: "^5.0.0",
      tsx: "^4.15.6",
      vitest: "^1.2.0",
      ...composed.devDependencies,
    },
  };

  const packageJsonPath = path.join(outputDir, "package.json");
  await writeFileWithHooks(packageJsonPath, JSON.stringify(packageJson, null, 2), options);
  files.push("package.json");

  for (const file of composed.files) {
    const filePath = path.join(outputDir, file.path);
    const dir = path.dirname(filePath);
    await ensureDirectory(dir, options);
    await writeFileWithHooks(filePath, file.content, options);
    files.push(file.path);
  }

  return files;
}
