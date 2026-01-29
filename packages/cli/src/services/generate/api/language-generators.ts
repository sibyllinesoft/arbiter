/**
 * @packageDocumentation
 * Language-specific code generators for various programming languages.
 *
 * Generates project scaffolding for TypeScript, Python, Rust, Go, and Shell
 * projects with proper configurations, build files, and test structure.
 */

import path from "node:path";
import type { ProjectConfig as LanguageProjectConfig } from "@/language-support/index.js";
import {
  configureTemplateOrchestrator,
  getConfiguredLanguagePlugin,
  initializeProject,
} from "@/services/generate/core/orchestration/template-orchestrator.js";
import type { ServiceGenerationTarget } from "@/services/generate/io/contexts.js";
import { getPrimaryServicePort } from "@/services/generate/util/docker/docker-generator.js";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import {
  joinRelativePath,
  toPathSegments,
  toRelativePath,
} from "@/services/generate/util/shared.js";
import type { GenerateOptions, GenerationReporter } from "@/services/generate/util/types.js";
import type { CLIConfig, ProjectStructureConfig } from "@/types.js";
import type { AppSpec } from "@arbiter/shared";
import fs from "fs-extra";

// Fallback reporter; generateCommand provides a scoped reporter when invoked
const reporter: GenerationReporter = {
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};

import {
  deriveServiceEndpointsFromFlows,
  deriveServiceEndpointsFromPaths,
  mergeRouteBindings,
} from "@/services/generate/api/route-derivation.js";

/**
 * Check if language supports shell fallback
 */
function isShellLanguage(language: string): boolean {
  return language === "shell" || language === "bash";
}

/**
 * Create project configuration from config object
 */
function createProjectConfig(config: any): LanguageProjectConfig {
  return {
    name: config.name,
    description: config.description,
    features: config.features || [],
    testing: config.testing !== false,
  };
}

/**
 * Write generated files to output directory
 */
async function writeGeneratedFiles(
  files: Array<{ path: string; content: string; executable?: boolean }>,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  const writtenFiles: string[] = [];

  for (const file of files) {
    const fullPath = path.join(outputDir, file.path);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir) && !options.dryRun) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await writeFileWithHooks(fullPath, file.content, options, file.executable ? 0o755 : undefined);

    writtenFiles.push(file.path);
  }

  return writtenFiles;
}

/**
 * Generate files using language plugin
 */
async function generateWithPlugin(
  plugin: any,
  language: string,
  config: any,
  outputDir: string,
  options: GenerateOptions,
  cliConfig?: CLIConfig,
): Promise<{ files: string[]; success: boolean }> {
  reporter.info(`📦 Generating ${language} project using ${plugin.name}...`);

  if (cliConfig) {
    configureTemplateOrchestrator(language, cliConfig);
  }

  const projectConfig = createProjectConfig(config);

  try {
    const result = await initializeProject(language, projectConfig);
    const files = await writeGeneratedFiles(result.files, outputDir, options);

    if (result.instructions) {
      result.instructions.forEach((instruction) => reporter.info(`✅ ${instruction}`));
    }

    return { files, success: true };
  } catch (error: any) {
    reporter.error(`❌ Failed to generate ${language} project:`, error.message);
    return { files: [], success: false };
  }
}

/**
 * Generate language-specific files using plugin system with fallback
 */
export async function generateLanguageFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  assemblyConfig?: any,
  cliConfig?: CLIConfig,
): Promise<string[]> {
  const language = config.language || "typescript";
  const plugin = getConfiguredLanguagePlugin(language);

  if (plugin) {
    const result = await generateWithPlugin(
      plugin,
      language,
      config,
      outputDir,
      options,
      cliConfig,
    );
    if (result.success) {
      return result.files;
    }
    // Fall through to shell fallback on plugin failure
  } else {
    reporter.info(`⚠️  No plugin available for language: ${language}`);
  }

  // Fallback for shell languages
  if (isShellLanguage(language)) {
    return generateShellFiles(config, outputDir, options, structure);
  }

  return [];
}

/**
 * Create TypeScript package.json content
 */
function createTsPackageJson(config: any) {
  return {
    name: config.name,
    version: config.version,
    type: "module",
    scripts: {
      dev: "tsx watch src/index.ts",
      start: "node dist/index.js",
      build: "tsc -p tsconfig.json",
      test: "vitest run --passWithNoTests",
      lint: 'eslint "src/**/*.ts"',
    },
    dependencies: {
      fastify: "^4.25.0",
      "@fastify/cors": "^9.0.0",
    },
    devDependencies: {
      "@types/node": "^20.0.0",
      typescript: "^5.0.0",
      tsx: "^4.15.6",
      eslint: "^8.57.1",
      "@typescript-eslint/parser": "^7.18.0",
      "@typescript-eslint/eslint-plugin": "^7.18.0",
      vitest: "^1.2.0",
    },
  };
}

/**
 * Create TypeScript tsconfig.json content
 */
function createTsConfig() {
  return {
    compilerOptions: {
      outDir: "dist",
      rootDir: "src",
      module: "NodeNext",
      target: "ES2022",
      moduleResolution: "NodeNext",
      resolveJsonModule: true,
      esModuleInterop: true,
      strict: true,
      skipLibCheck: true,
    },
    include: ["src"],
    exclude: ["dist", "node_modules"],
  };
}

/**
 * Create ESLint configuration content
 */
function createEslintConfig(): string {
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
 * Create TypeScript index.ts content
 */
function createTsIndexContent(serviceName: string, defaultPort: number): string {
  return `import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes/index.js';

async function bootstrap() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await registerRoutes(app);

  const defaultPort = ${defaultPort};
  const port = Number(process.env.PORT || defaultPort);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    app.log.info('Service "${serviceName}" listening on %d', port);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

export { bootstrap };
`;
}

/**
 * Parse a single endpoint definition
 */
function parseEndpointDefinition(
  endpoint: any,
  index: number,
  defaultName: string,
): { method: string; url: string; summary?: string; reply: string; statusCode: number } {
  if (typeof endpoint === "string") {
    const [methodPart, ...urlParts] = endpoint.trim().split(/\s+/);
    return {
      method: (methodPart || "GET").toUpperCase(),
      url: urlParts.join(" ") || `/${defaultName}`,
      summary: undefined,
      reply: `not_implemented_${index}`,
      statusCode: 200,
    };
  }

  return {
    method: (endpoint.method || "GET").toUpperCase(),
    url: endpoint.path || endpoint.url || `/${defaultName}`,
    summary: endpoint.summary,
    reply: endpoint.replyExample || `not_implemented_${index}`,
    statusCode: endpoint.statusCode || 200,
  };
}

/**
 * Parse endpoint routes from service spec
 */
function parseEndpointRoutes(endpoints: any, defaultName: string) {
  const endpointList = Array.isArray(endpoints) ? endpoints : [];
  return endpointList.map((endpoint: any, index: number) =>
    parseEndpointDefinition(endpoint, index, defaultName),
  );
}

/**
 * Write TypeScript config files (package.json, tsconfig.json)
 */
async function writeTsConfigFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];

  const packageJson = createTsPackageJson(config);
  const packagePath = path.join(outputDir, "package.json");
  await writeFileWithHooks(packagePath, JSON.stringify(packageJson, null, 2), options);
  files.push("package.json");

  const tsconfigJson = createTsConfig();
  const tsconfigPath = path.join(outputDir, "tsconfig.json");
  await writeFileWithHooks(tsconfigPath, JSON.stringify(tsconfigJson, null, 2), options);
  files.push("tsconfig.json");

  return files;
}

/**
 * Convert OpenAPI path parameter syntax {param} to Fastify syntax :param
 */
function convertPathParamsToFastify(url: string): string {
  return url.replace(/\{([^}]+)\}/g, ":$1");
}

/**
 * Generate Fastify routes index.ts content
 */
function generateFastifyRoutesContent(serviceName: string, routes: any[]): string {
  // Convert OpenAPI path params to Fastify format
  const convertedRoutes = routes.map((route) => ({
    ...route,
    url: convertPathParamsToFastify(route.url),
  }));

  return `import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

interface RouteBinding {
  method: string;
  url: string;
  summary?: string;
  reply?: unknown;
  statusCode?: number;
}

const routeDefinitions: RouteBinding[] = ${JSON.stringify(convertedRoutes, null, 2)};
const SERVICE_NAME = "${serviceName}";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.status(200).send({
      status: 'ok',
      service: SERVICE_NAME,
      timestamp: new Date().toISOString(),
    });
  });

  for (const definition of routeDefinitions) {
    app.route({
      method: definition.method as any,
      url: definition.url,
      handler: async (_request: FastifyRequest, reply: FastifyReply) => {
        reply.status(definition.statusCode ?? 200).send({
          route: definition.url,
          status: 'stubbed',
          summary: definition.summary,
          example: definition.reply,
        });
      },
    });
  }

  if (routeDefinitions.length === 0) {
    app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.status(200).send({
        service: SERVICE_NAME,
        status: 'pending_implementation',
        message: 'Update src/routes/index.ts to expose application endpoints.',
      });
    });
  }
}

export const routes = routeDefinitions;
`;
}

/**
 * Combine routes from multiple sources (endpoints, paths, flows)
 */
function combineServiceRoutes(
  serviceSpec: any,
  serviceName: string,
  originalName: string,
  appSpec: AppSpec | undefined,
  pathOwnership: Map<string, string> | undefined,
): any[] {
  const parsedRoutes = parseEndpointRoutes(serviceSpec.endpoints, serviceName);
  const derivedRoutes = deriveServiceEndpointsFromPaths(
    appSpec,
    originalName,
    serviceName,
    serviceSpec,
    pathOwnership,
  );
  const flowDerivedRoutes = deriveServiceEndpointsFromFlows(
    appSpec,
    originalName,
    serviceName,
    serviceSpec,
  );
  return mergeRouteBindings(mergeRouteBindings(parsedRoutes, derivedRoutes), flowDerivedRoutes);
}

/**
 * Generate TypeScript project files
 */
export async function generateTypeScriptFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  serviceTarget?: ServiceGenerationTarget,
  appSpec?: AppSpec,
  pathOwnership?: Map<string, string>,
): Promise<string[]> {
  const files: string[] = [];
  const serviceSpec = config.service ?? {};
  const defaultPort = getPrimaryServicePort(serviceSpec, 3000);

  // Write config files
  const configFiles = await writeTsConfigFiles(config, outputDir, options);
  files.push(...configFiles);

  // Write ESLint config
  await writeFileWithHooks(path.join(outputDir, ".eslintrc.cjs"), createEslintConfig(), options);
  files.push(".eslintrc.cjs");

  // Create src directory and index.ts
  const srcDir = path.join(outputDir, "src");
  await ensureDirectory(srcDir, options);
  await writeFileWithHooks(
    path.join(srcDir, "index.ts"),
    createTsIndexContent(config.name, defaultPort),
    options,
  );
  files.push("src/index.ts");

  // Generate routes
  const routesDir = serviceTarget?.context.routesDir || path.join(srcDir, "routes");
  await ensureDirectory(routesDir, options);

  const combinedRoutes = combineServiceRoutes(
    serviceSpec,
    config.name,
    config.originalName ?? config.name,
    appSpec,
    pathOwnership,
  );

  await writeFileWithHooks(
    path.join(routesDir, "index.ts"),
    generateFastifyRoutesContent(config.name, combinedRoutes),
    options,
  );
  files.push("src/routes/index.ts");

  // Setup tests directory
  const testsEntry = setupTestsDirectory(outputDir, structure, serviceTarget, options);
  if (testsEntry) {
    files.push(testsEntry);
  }

  return files;
}

/**
 * Parsed Python route definition
 */
interface PythonRouteDefinition {
  method: string;
  url: string;
  name: string;
  summary?: string;
}

/**
 * Parse a single Python endpoint from spec
 */
function parsePythonEndpoint(
  endpoint: any,
  index: number,
  defaultName: string,
): PythonRouteDefinition {
  if (typeof endpoint === "string") {
    const [methodPart, ...urlParts] = endpoint.trim().split(/\s+/);
    const method = (methodPart ?? "GET").toLowerCase();
    const url = urlParts.join(" ") || `/${defaultName}`;
    return { method, url, name: `${method}_${index}`, summary: undefined };
  }

  return {
    method: (endpoint?.method ?? "GET").toLowerCase(),
    url: endpoint?.path ?? endpoint?.url ?? `/${defaultName}`,
    name: endpoint?.operationId ?? `handler_${index}`,
    summary: endpoint?.summary,
  };
}

/**
 * Generate Python route block code
 */
function generatePythonRouteBlock(route: PythonRouteDefinition): string {
  const summary = (route.summary ?? "Generated endpoint stub")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ");
  return [
    `@router.${route.method}("${route.url}")`,
    `async def ${route.name}() -> dict[str, str]:`,
    `    """${summary}"""`,
    `    return {"route": "${route.url}", "status": "not_implemented"}`,
    "",
  ].join("\n");
}

/**
 * Generate Python routes module content
 */
function generatePythonRoutesInit(routes: PythonRouteDefinition[]): string {
  const routeBlocks = routes.map(generatePythonRouteBlock).join("\n");
  return [
    "from fastapi import APIRouter, FastAPI",
    "",
    "router = APIRouter()",
    "",
    routeBlocks,
    "async def register_routes(app: FastAPI) -> None:",
    "    app.include_router(router)",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Generate Python pyproject.toml content
 */
function generatePyprojectToml(name: string, version: string): string {
  return `[build-system]\nrequires = ["setuptools>=45", "wheel"]\nbuild-backend = "setuptools.build_meta"\n\n[project]\nname = "${name}"\nversion = "${version}"\ndescription = "Generated by Arbiter"\nrequires-python = ">=3.10"\ndependencies = [\n    "fastapi>=0.110.0",\n    "uvicorn[standard]>=0.27.0",\n    "pydantic>=2.5.0"\n]\n`;
}

/**
 * Generate Python main.py content
 */
function generatePythonMainContent(name: string, port: number): string {
  return `from fastapi import FastAPI\nfrom .routes import register_routes\n\napp = FastAPI(title="${name}")\n\n@app.on_event("startup")\nasync def startup_event() -> None:\n    await register_routes(app)\n\n\n@app.get("/health")\nasync def healthcheck() -> dict[str, str]:\n    return {"status": "ok"}\n\n\ndef build_app() -> FastAPI:\n    return app\n\n\nif __name__ == "__main__":\n    import uvicorn\n\n    uvicorn.run(app, host="0.0.0.0", port=${port})\n`;
}

/**
 * Python requirements content
 */
const PYTHON_REQUIREMENTS_CONTENT = "fastapi>=0.110.0\nuvicorn[standard]>=0.27.0\n";

/**
 * Write Python project configuration files (pyproject.toml, requirements.txt)
 */
async function writePythonConfigFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];

  await writeFileWithHooks(
    path.join(outputDir, "pyproject.toml"),
    generatePyprojectToml(config.name, config.version),
    options,
  );
  files.push("pyproject.toml");

  await writeFileWithHooks(
    path.join(outputDir, "requirements.txt"),
    PYTHON_REQUIREMENTS_CONTENT,
    options,
  );
  files.push("requirements.txt");

  return files;
}

/**
 * Create default Python route when no endpoints are defined
 */
function createDefaultPythonRoute(name: string): PythonRouteDefinition {
  return {
    method: "get",
    url: "/",
    name: `${name}_root`,
    summary: `Default endpoint for ${name}`,
  };
}

/**
 * Write Python app module files (main.py, routes, __init__.py)
 */
async function writePythonAppModule(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  serviceSpec: any,
): Promise<string[]> {
  const files: string[] = [];
  const appDir = path.join(outputDir, "app");
  const routesDir = path.join(appDir, "routes");

  await ensureDirectory(appDir, options);
  await ensureDirectory(routesDir, options);

  // Write main.py
  const port = typeof serviceSpec.port === "number" ? serviceSpec.port : 8000;
  await writeFileWithHooks(
    path.join(appDir, "main.py"),
    generatePythonMainContent(config.name, port),
    options,
  );
  files.push("app/main.py");

  // Parse endpoints and generate routes
  const endpoints = Array.isArray(serviceSpec.endpoints) ? serviceSpec.endpoints : [];
  const parsedRoutes = endpoints.map((ep: any, idx: number) =>
    parsePythonEndpoint(ep, idx, config.name),
  );
  const routes = parsedRoutes.length > 0 ? parsedRoutes : [createDefaultPythonRoute(config.name)];

  await writeFileWithHooks(
    path.join(routesDir, "__init__.py"),
    generatePythonRoutesInit(routes),
    options,
  );
  files.push("app/routes/__init__.py");

  await writeFileWithHooks(path.join(appDir, "__init__.py"), "", options);
  files.push("app/__init__.py");

  return files;
}

/**
 * Generate Python project files
 */
export async function generatePythonFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  serviceTarget?: ServiceGenerationTarget,
): Promise<string[]> {
  const files: string[] = [];
  const serviceSpec = config.service ?? {};

  // Write config files
  const configFiles = await writePythonConfigFiles(config, outputDir, options);
  files.push(...configFiles);

  // Write app module
  const appFiles = await writePythonAppModule(config, outputDir, options, serviceSpec);
  files.push(...appFiles);

  // Setup tests directory
  const testsEntry = setupTestsDirectory(outputDir, structure, serviceTarget, options);
  if (testsEntry) {
    files.push(testsEntry);
  }

  return files;
}

/**
 * Generate Cargo.toml content for Rust project
 */
function generateCargoToml(name: string, version: string): string {
  return `[package]
name = "${name}"
version = "${version}"
edition = "2021"

[dependencies]
axum = "0.7"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
tower = "0.5"

[dev-dependencies]
hyper = "1"
tokio = { version = "1", features = ["full"] }
`;
}

/**
 * Generate main.rs content for Rust Axum service
 */
function generateRustMainContent(): string {
  return `use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::net::SocketAddr;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
}

fn build_router() -> Router {
    Router::new().route(
        "/health",
        get(|| async { Json(HealthResponse { status: "ok" }) }),
    )
}

#[tokio::main]
async fn main() {
    let router = build_router();
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(3000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    println!("{} listening on {}", env!("CARGO_PKG_NAME"), addr);

    axum::Server::bind(&addr)
        .serve(router.into_make_service())
        .await
        .expect("server failed");
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    #[tokio::test]
    async fn health_endpoint_returns_ok() {
        let app = build_router();
        let response = app
            .oneshot(Request::builder().uri("/health").body(()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}
`;
}

/**
 * Resolve effective test directory segments
 */
function resolveTestSegments(structure: ProjectStructureConfig): string[] {
  const testsDirSegments = toPathSegments(structure.testsDirectory);
  return testsDirSegments.length > 0 ? testsDirSegments : ["tests"];
}

/**
 * Ensure tests directory exists
 */
function ensureTestsDirectoryExists(resolvedTestsDir: string, options: GenerateOptions): void {
  if (!fs.existsSync(resolvedTestsDir) && !options.dryRun) {
    fs.mkdirSync(resolvedTestsDir, { recursive: true });
  }
}

/**
 * Format relative path with trailing slash
 */
function formatWithTrailingSlash(relativePath: string): string {
  return relativePath.endsWith("/") ? relativePath : `${relativePath}/`;
}

/**
 * Setup tests directory and return relative path entry
 */
function setupTestsDirectory(
  outputDir: string,
  structure: ProjectStructureConfig,
  serviceTarget: ServiceGenerationTarget | undefined,
  options: GenerateOptions,
): string | null {
  const effectiveTestSegments = resolveTestSegments(structure);
  const resolvedTestsDir =
    serviceTarget?.context?.testsDir || path.join(outputDir, ...effectiveTestSegments);

  ensureTestsDirectoryExists(resolvedTestsDir, options);

  if (serviceTarget?.context) {
    const relative = toRelativePath(serviceTarget.context.root, resolvedTestsDir);
    return relative ? formatWithTrailingSlash(relative) : null;
  }

  const testsDirRelative = joinRelativePath(...effectiveTestSegments);
  return testsDirRelative ? formatWithTrailingSlash(testsDirRelative) : null;
}

export async function generateRustFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  serviceTarget?: ServiceGenerationTarget,
): Promise<string[]> {
  const files: string[] = [];

  // Setup tests directory
  const testsEntry = setupTestsDirectory(outputDir, structure, serviceTarget, options);
  if (testsEntry) {
    files.push(testsEntry);
  }

  // Generate Cargo.toml
  const cargoPath = path.join(outputDir, "Cargo.toml");
  await writeFileWithHooks(cargoPath, generateCargoToml(config.name, config.version), options);
  files.push("Cargo.toml");

  // Ensure src directory exists
  const srcDir = path.join(outputDir, "src");
  if (!fs.existsSync(srcDir) && !options.dryRun) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  // Generate main.rs
  await writeFileWithHooks(path.join(srcDir, "main.rs"), generateRustMainContent(), options);
  files.push("src/main.rs");

  return files;
}

/**
 * Generate go.mod content
 */
function generateGoModContent(moduleName: string): string {
  return `module ${moduleName}

go 1.21

require ()
`;
}

/**
 * Generate main.go content
 */
function generateGoMainContent(name: string, version: string): string {
  return `// ${name} - Generated by Arbiter
// Version: ${version}
package main

import "fmt"

func main() {
    fmt.Println("Hello from ${name}!")
}
`;
}

/**
 * Generate Go project files
 */
export async function generateGoFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  serviceTarget?: ServiceGenerationTarget,
): Promise<string[]> {
  const files: string[] = [];

  // Setup tests directory
  const testsEntry = setupTestsDirectory(outputDir, structure, serviceTarget, options);
  if (testsEntry) {
    files.push(testsEntry);
  }

  // Write go.mod
  await writeFileWithHooks(
    path.join(outputDir, "go.mod"),
    generateGoModContent(config.name),
    options,
  );
  files.push("go.mod");

  // Write main.go
  await writeFileWithHooks(
    path.join(outputDir, "main.go"),
    generateGoMainContent(config.name, config.version),
    options,
  );
  files.push("main.go");

  // Create tests/api directory
  const testsDirSegments = toPathSegments(structure.testsDirectory || "tests");
  const resolvedTestsDir =
    serviceTarget?.context?.testsDir || path.join(outputDir, ...testsDirSegments);
  const testApiDir = path.join(resolvedTestsDir, "api");
  if (!fs.existsSync(testApiDir) && !options.dryRun) {
    fs.mkdirSync(testApiDir, { recursive: true });
  }

  return files;
}

/**
 * Generate Makefile content for Shell project
 */
function generateShellMakefile(config: { name: string; version: string }): string {
  return `# ${config.name} - Generated by Arbiter
# Version: ${config.version}

.PHONY: test install clean

test:
\tbash test/run_tests.sh

install:
\tcp src/${config.name} /usr/local/bin/

clean:
\trm -f *.log *.tmp
`;
}

/**
 * Generate main Bash script content
 */
function generateShellMainScript(config: { name: string; version: string }): string {
  return `#!/bin/bash
# ${config.name} - Generated by Arbiter
# Version: ${config.version}

set -euo pipefail

main() {
    echo "Hello from ${config.name}!"
}

# Run main if script is executed directly
if [[ "\${BASH_SOURCE[0]}" == "\${0}" ]]; then
    main "$@"
fi
`;
}

/**
 * Ensure directory exists if not in dry-run mode
 */
function ensureShellDirectory(dirPath: string, dryRun: boolean): void {
  if (!fs.existsSync(dirPath) && !dryRun) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Generate Shell/Bash project files
 */
export async function generateShellFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  const files: string[] = [];

  const testsDirSegments = toPathSegments(structure.testsDirectory);
  const effectiveTestSegments = testsDirSegments.length > 0 ? testsDirSegments : ["tests"];
  const testsDirRelative = joinRelativePath(...effectiveTestSegments);

  const makefilePath = path.join(outputDir, "Makefile");
  await writeFileWithHooks(makefilePath, generateShellMakefile(config), options);
  files.push("Makefile");

  const srcDir = path.join(outputDir, "src");
  ensureShellDirectory(srcDir, !!options.dryRun);

  const scriptPath = path.join(srcDir, config.name);
  await writeFileWithHooks(scriptPath, generateShellMainScript(config), options, 0o755);
  files.push(`src/${config.name}`);

  const testsDir = path.join(outputDir, ...effectiveTestSegments);
  ensureShellDirectory(testsDir, !!options.dryRun);

  if (testsDirRelative) {
    files.push(`${testsDirRelative}/`);
  }

  return files;
}
