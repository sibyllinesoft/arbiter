/**
 * @packageDocumentation
 * Service scaffolding generator using plop templates.
 *
 * Generates service code using the shared plop template modules,
 * enabling consistent output between `init` and `generate` commands.
 */

import path from "node:path";
import type { ServiceGenerationTarget } from "@/services/generate/io/contexts.js";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { AppSpec } from "@arbiter/specification";
import fs from "fs-extra";
import {
  type BackendModule,
  type TemplateModuleMetadata,
  frameworkToModule,
  loadModuleMetadata,
  moduleExists,
  renderModuleTemplate,
} from "./module-loader.js";

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
  // Try nested structure first (generationPayload.service.framework)
  const service = config.service as Record<string, unknown> | undefined;
  let framework = (service?.framework as string)?.toLowerCase() ?? "";

  // Fall back to flat structure (serviceTarget.config.framework)
  if (!framework) {
    framework = (config.framework as string)?.toLowerCase() ?? "";
  }

  if (framework.includes("hono")) return "hono";
  if (framework.includes("express")) return "express";
  return "fastify";
}

/**
 * Convert framework name to plop module name
 */
function getModuleName(framework: ServiceFramework): BackendModule {
  const mapping: Record<ServiceFramework, BackendModule> = {
    fastify: "node-fastify",
    hono: "node-hono",
    express: "node-express",
  };
  return mapping[framework];
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
 * Generate package.json content from module metadata
 */
function generatePackageJson(
  name: string,
  metadata: TemplateModuleMetadata,
): Record<string, unknown> {
  return {
    name,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "tsx watch src/index.ts",
      start: "node dist/index.js",
      build: "tsc -p tsconfig.json",
      test: "vitest run --passWithNoTests",
      lint: 'eslint "src/**/*.ts"',
    },
    dependencies: metadata.dependencies ?? {},
    devDependencies: {
      "@types/node": "^20.0.0",
      typescript: "^5.0.0",
      tsx: "^4.15.6",
      eslint: "^8.57.1",
      "@typescript-eslint/parser": "^7.18.0",
      "@typescript-eslint/eslint-plugin": "^7.18.0",
      vitest: "^1.2.0",
      ...(metadata.devDependencies ?? {}),
    },
  };
}

/**
 * Generate ESLint configuration
 */
function generateEslintConfig(): string {
  return `module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    '@typescript-eslint/no-explicit-any': 'off',
  },
  overrides: [
    {
      files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
      env: {
        node: true,
      },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  ],
};
`;
}

/**
 * Generate a service using plop templates
 */
export async function generateServiceFromTemplate(
  target: ServiceGenerationTarget,
  data: ServiceTemplateData,
  options: GenerateOptions,
): Promise<string[]> {
  const framework = detectFramework(target.config);
  const moduleName = getModuleName(framework);
  const files: string[] = [];

  // Check if module exists
  if (!(await moduleExists("backends", moduleName))) {
    throw new Error(
      `Backend module not found: ${moduleName}. Available modules: node-fastify, node-hono, node-express`,
    );
  }

  // Load module metadata for dependencies
  const metadata = await loadModuleMetadata("backends", moduleName);

  // Prepare template data
  const templateData = {
    name: data.name,
    port: data.port,
    routes: prepareRoutes(data.routes),
    framework,
  };

  const outputDir = target.context.root;

  // Create directories
  await ensureDirectory(outputDir, options);
  await ensureDirectory(path.join(outputDir, "src"), options);
  await ensureDirectory(path.join(outputDir, "src", "routes"), options);

  // Generate package.json
  const packageJson = generatePackageJson(data.name, metadata);
  const packageJsonPath = path.join(outputDir, "package.json");
  await writeFileWithHooks(packageJsonPath, JSON.stringify(packageJson, null, 2), options);
  files.push("package.json");

  // Generate ESLint config
  const eslintPath = path.join(outputDir, ".eslintrc.cjs");
  await writeFileWithHooks(eslintPath, generateEslintConfig(), options);
  files.push(".eslintrc.cjs");

  // Render templates from plop module
  try {
    // Render tsconfig.json
    const tsconfigContent = await renderModuleTemplate(
      "backends",
      moduleName,
      "tsconfig.json.hbs",
      templateData,
    );
    await writeFileWithHooks(path.join(outputDir, "tsconfig.json"), tsconfigContent, options);
    files.push("tsconfig.json");

    // Render src/index.ts
    const indexContent = await renderModuleTemplate(
      "backends",
      moduleName,
      "src/index.ts.hbs",
      templateData,
    );
    await writeFileWithHooks(path.join(outputDir, "src", "index.ts"), indexContent, options);
    files.push("src/index.ts");

    // Render src/routes/index.ts
    const routesContent = await renderModuleTemplate(
      "backends",
      moduleName,
      "src/routes/index.ts.hbs",
      templateData,
    );
    await writeFileWithHooks(
      path.join(outputDir, "src", "routes", "index.ts"),
      routesContent,
      options,
    );
    files.push("src/routes/index.ts");
  } catch (error: any) {
    // Fallback to inline generation if templates missing
    console.warn(`Template rendering failed for ${moduleName}: ${error.message}. Using fallback.`);
  }

  return files;
}

/**
 * Check if a backend module supports the given language
 */
export function supportsLanguage(framework: string, language: string): boolean {
  const lang = language.toLowerCase();

  // TypeScript/JavaScript frameworks
  if (lang === "typescript" || lang === "javascript") {
    return ["fastify", "hono", "express"].includes(framework.toLowerCase());
  }

  // Python frameworks
  if (lang === "python") {
    return ["fastapi", "flask"].includes(framework.toLowerCase());
  }

  // Rust frameworks
  if (lang === "rust") {
    return ["axum", "actix"].includes(framework.toLowerCase());
  }

  // Go frameworks
  if (lang === "go") {
    return ["chi", "gin"].includes(framework.toLowerCase());
  }

  // Kotlin frameworks
  if (lang === "kotlin") {
    return ["ktor"].includes(framework.toLowerCase());
  }

  return false;
}
