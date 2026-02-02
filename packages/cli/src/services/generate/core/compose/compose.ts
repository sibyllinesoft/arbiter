/**
 * @packageDocumentation
 * Docker Compose file generation from application specifications.
 *
 * Generates docker-compose.yml files with service definitions,
 * network configurations, and deployment overrides.
 */

import path from "node:path";
import {
  CLIENT_COMPONENT_LABEL,
  type ComposeServiceConfig,
  buildHostPortVariable,
  generateComposeService,
  resolveHealthConfiguration,
  shouldPublishPorts,
} from "@/services/generate/core/compose/compose-service-sections.js";
import type { ClientGenerationContext } from "@/services/generate/io/contexts.js";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import { joinRelativePath, slugify, toPathSegments } from "@/services/generate/util/shared.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { ProjectStructureConfig } from "@/types.js";
import {
  resolveServiceArtifactType,
  resolveServiceWorkload,
} from "@/utils/api/service-metadata.js";
import type { PackageManagerCommandSet } from "@/utils/io/package-manager.js";
import type { DeploymentConfig, ServiceDeploymentOverride } from "@arbiter/specification";
import fs from "fs-extra";

export type { ComposeServiceConfig } from "@/services/generate/core/compose/compose-service-sections.js";

type ComposeDeploymentSelection = {
  deployment: DeploymentConfig | null;
  overrides: Record<string, ServiceDeploymentOverride>;
};

interface ComposeDeploymentContext {
  envName?: string;
  slug?: string;
  deployment?: DeploymentConfig | null;
  overrides?: Record<string, ServiceDeploymentOverride>;
}

/**
 * Select the appropriate compose deployment configuration from CUE data.
 * @param cueData - Raw CUE configuration data
 * @returns Selected deployment configuration and service overrides
 */
function extractServiceOverrides(
  config: DeploymentConfig,
): Record<string, ServiceDeploymentOverride> {
  if (config?.services && typeof config.services === "object") {
    return config.services as Record<string, ServiceDeploymentOverride>;
  }
  return {};
}

function buildDeploymentSelection(
  environment: string,
  config: DeploymentConfig,
): ComposeDeploymentSelection {
  return {
    deployment: { ...config, environment },
    overrides: extractServiceOverrides(config),
  };
}

function selectComposeDeployment(cueData: any): ComposeDeploymentSelection {
  const deployments = cueData?.deployments;
  if (!deployments || typeof deployments !== "object") {
    return { deployment: null, overrides: {} };
  }

  const entries = Object.entries(deployments as Record<string, DeploymentConfig>);
  const match = entries.find(([, cfg]) => cfg?.target === "compose") || entries[0];

  if (!match) {
    return { deployment: null, overrides: {} };
  }

  const [environment, config] = match;
  return buildDeploymentSelection(environment, config);
}

/**
 * Apply deployment overrides to a base service configuration.
 * @param base - Base service configuration
 * @param override - Optional override configuration to merge
 * @returns Merged configuration with overrides applied
 */
function applyComposeOverrides(
  base: Record<string, unknown>,
  override?: ServiceDeploymentOverride | null,
): Record<string, unknown> {
  if (!override) {
    return base;
  }

  const merged = { ...base };

  if (typeof override.replicas === "number") {
    merged.replicas = override.replicas;
  }

  if (override.image) {
    merged.image = override.image;
  }

  if (override.env) {
    merged.env = { ...(base.env as Record<string, string> | undefined), ...override.env };
  }

  if (override.config) {
    merged.config = { ...(base.config as Record<string, unknown> | undefined), ...override.config };
  }

  if (override.annotations) {
    merged.annotations = {
      ...(base.annotations as Record<string, string> | undefined),
      ...override.annotations,
    };
  }

  if (override.labels) {
    merged.labels = { ...(base.labels as Record<string, string> | undefined), ...override.labels };
  }

  if (override.dependsOn) {
    merged.dependsOn = override.dependsOn;
  }

  return merged;
}

/**
 * Generate all Docker Compose related artifacts for a project.
 * @param config - Project configuration
 * @param outputDir - Output directory path
 * @param assemblyConfig - CUE assembly configuration
 * @param options - Generation options
 * @param structure - Project structure configuration
 * @param clientContext - Optional client generation context
 * @param deploymentContext - Optional deployment context
 * @param packageManager - Optional package manager command set
 * @returns Array of generated file paths
 */
export async function generateDockerComposeArtifacts(
  config: any,
  outputDir: string,
  assemblyConfig: any,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  clientContext?: ClientGenerationContext,
  deploymentContext?: ComposeDeploymentContext,
  packageManager?: PackageManagerCommandSet,
): Promise<string[]> {
  const files: string[] = [];
  const composeSegments = [...toPathSegments(structure.infraDirectory), "compose"];
  const composeRoot = path.join(outputDir, ...composeSegments);
  const composeRelativeRoot = composeSegments;

  await ensureDirectory(composeRoot, options);

  const { services, deployment } = parseDockerComposeServices(assemblyConfig, deploymentContext);

  if (!deployment) {
    return files;
  }

  const resolvedServices = prepareComposeServices(
    services,
    outputDir,
    structure,
    composeRoot,
    composeRelativeRoot,
    clientContext,
  );

  const suffix = deploymentContext?.slug ? `.${deploymentContext.slug}` : "";
  const composeFile = `docker-compose${suffix}.yml`;
  const composeYml = generateDockerComposeFile(resolvedServices, deployment, config.name);
  const composePath = path.join(composeRoot, composeFile);
  await writeFileWithHooks(composePath, composeYml, options);
  files.push(joinRelativePath(...composeRelativeRoot, composeFile));

  const envTemplate = generateComposeEnvTemplate(resolvedServices, config.name, deployment);
  const envFile = `.env${suffix}.template`;
  const envPath = path.join(composeRoot, envFile);
  await writeFileWithHooks(envPath, envTemplate, options);
  files.push(joinRelativePath(...composeRelativeRoot, envFile));

  const buildFiles = await generateBuildContexts(
    resolvedServices,
    composeRoot,
    options,
    composeRelativeRoot,
    packageManager,
  );
  files.push(...buildFiles);

  const readme = generateComposeReadme(resolvedServices, deployment, config.name);
  const readmeFile = `README${suffix || ""}.md`;
  const readmePath = path.join(composeRoot, readmeFile);
  await writeFileWithHooks(readmePath, readme, options);
  files.push(joinRelativePath(...composeRelativeRoot, readmeFile));

  return files;
}

/**
 * Resolve deployment and overrides from context or CUE data
 */
function resolveDeploymentAndOverrides(
  context: ComposeDeploymentContext | undefined,
  cueData: any,
): {
  deployment: DeploymentConfig | null;
  overrides: Record<string, ServiceDeploymentOverride> | undefined;
} {
  if (context?.deployment) {
    return { deployment: context.deployment, overrides: context.overrides };
  }

  const selection = selectComposeDeployment(cueData);
  return { deployment: selection.deployment, overrides: selection.overrides };
}

/**
 * Build resolved deployment configuration with defaults
 */
function buildResolvedDeployment(deployment: DeploymentConfig): DeploymentConfig {
  const composeVersion = deployment?.compose?.version;
  return {
    target: deployment?.target || "compose",
    compose: {
      version: typeof composeVersion === "string" ? composeVersion : undefined,
      networks: deployment?.compose?.networks || {},
      volumes: deployment?.compose?.volumes || {},
      profiles: deployment?.compose?.profiles || [],
      environment: deployment?.compose?.environment || {},
    },
    environment: deployment?.environment,
  };
}

/**
 * Parse all services from CUE data packages with overrides applied.
 */
function parseServicesFromCueData(
  cueData: any,
  overrides: Record<string, ServiceDeploymentOverride> | undefined,
): ComposeServiceConfig[] {
  const services: ComposeServiceConfig[] = [];

  // Handle packages structure (packages with subtype service/worker)
  if (cueData?.packages) {
    for (const [packageName, packageConfig] of Object.entries(cueData.packages)) {
      const config = packageConfig as Record<string, unknown>;
      const subtype = config.subtype as string | undefined;

      // Only include packages that are services or workers for compose generation
      if (subtype === "service" || subtype === "worker" || config.port) {
        const merged = applyComposeOverrides(config, overrides?.[packageName]);
        const service = parseServiceForCompose(packageName, merged as any);
        if (service) {
          services.push(service);
        }
      }
    }
  }

  // Handle resources structure (infrastructure like databases, caches)
  if (cueData?.resources) {
    for (const [resourceName, resourceConfig] of Object.entries(cueData.resources)) {
      const config = resourceConfig as Record<string, unknown>;
      const merged = applyComposeOverrides(config, overrides?.[resourceName]);
      const service = parseResourceForCompose(resourceName, merged as any);
      if (service) {
        services.push(service);
      }
    }
  }

  return services;
}

/**
 * Parse a resource configuration for Docker Compose.
 * Resources are infrastructure like databases, caches, queues.
 */
function parseResourceForCompose(name: string, config: any): ComposeServiceConfig | null {
  if (!config.kind) {
    return null;
  }

  const service: ComposeServiceConfig = {
    name: name,
    artifactType: config.kind, // database, cache, queue, etc.
    language: "container",
    workload: "deployment",
    replicas: 1,
    image: config.image,
    ports: config.ports,
    env: config.env || {},
    volumes: [],
    healthCheck: config.healthCheck,
    labels: {},
    resources: config.resources,
  };

  return service;
}

/**
 * Parse Docker Compose services from assembly configuration.
 * @param assemblyConfig - CUE assembly configuration data
 * @param context - Optional deployment context for overrides
 * @returns Parsed services array and deployment configuration
 */
export function parseDockerComposeServices(
  assemblyConfig: any,
  context?: ComposeDeploymentContext,
): {
  services: ComposeServiceConfig[];
  deployment: DeploymentConfig | null;
} {
  const cueData = assemblyConfig._fullCueData || assemblyConfig;
  const { deployment, overrides } = resolveDeploymentAndOverrides(context, cueData);

  if (!deployment) {
    return { services: [], deployment: null };
  }

  const resolvedDeployment = buildResolvedDeployment(deployment);
  const services = parseServicesFromCueData(cueData, overrides);

  return { services, deployment: resolvedDeployment };
}

/**
 * Parse a single service configuration for Docker Compose.
 * @param name - Service name
 * @param config - Raw service configuration
 * @returns Parsed compose service config or null if invalid
 */
function parseServiceForCompose(name: string, config: any): ComposeServiceConfig | null {
  const artifactType = resolveServiceArtifactType(config);
  const workload = resolveServiceWorkload(config) || config.workload || "deployment";

  const service: ComposeServiceConfig = {
    name: name,
    artifactType,
    language: config.language || "container",
    workload,
    replicas: config.replicas || 1,
    image: config.image,
    sourceDirectory: config.sourceDirectory,
    buildContext: config.buildContext,
    ports: config.ports,
    env: collectServiceEnvironmentVariables(config),
    volumes: Array.isArray(config.volumes)
      ? config.volumes.map((volume: any) => ({
          ...volume,
          type: volume?.type || "persistentVolumeClaim",
        }))
      : [],
    dependencies: Array.isArray(config.dependsOn)
      ? (config.dependsOn as string[]).map((dep) => String(dep))
      : undefined,
    profiles: config.profiles,
    healthCheck: config.healthCheck,
    readinessProbe: config.readinessProbe,
    livenessProbe: config.livenessProbe,
    startupProbe: config.startupProbe,
    labels: {
      ...config.labels,
      [CLIENT_COMPONENT_LABEL]: config.component || config.type === "component" ? "true" : "false",
    },
    resources: config.resources,
    scaling: config.scaling,
    config: config.config,
  };

  return service;
}

/**
 * Collect environment variables from a service configuration.
 * @param config - Service configuration object
 * @returns Record of environment variable names to values
 */
/**
 * Process envFrom source and add to env record.
 */
function processEnvFromSource(source: any, env: Record<string, string>): void {
  if (source.secretRef?.name) {
    const key = `SECRET_${slugify(source.secretRef.name, "secret").toUpperCase()}`;
    env[key] = `\${${source.secretRef.name.toUpperCase()}_SECRET}`;
  }
  if (source.configMapRef?.name) {
    const key = `CONFIG_${slugify(source.configMapRef.name, "config").toUpperCase()}`;
    env[key] = `\${${source.configMapRef.name.toUpperCase()}_CONFIG}`;
  }
}

function collectServiceEnvironmentVariables(config: any): Record<string, string> {
  const env: Record<string, string> = {};

  if (config.env && typeof config.env === "object") {
    Object.assign(env, config.env);
  }

  if (config.environment && typeof config.environment === "object") {
    Object.assign(env, config.environment);
  }

  if (config.envFrom && Array.isArray(config.envFrom)) {
    config.envFrom.forEach((source: any) => processEnvFromSource(source, env));
  }

  return env;
}

interface BuildContextResolution {
  buildContext: string;
  sourceDirectory: string;
}

interface BuildContextResolverParams {
  service: ComposeServiceConfig;
  outputDir: string;
  composeRoot: string;
  composeSegments: string[];
  clientContext?: ClientGenerationContext;
}

/**
 * Resolve build context from explicit source directory.
 */
function resolveFromSourceDirectory(
  sourceDirectory: string,
  outputDir: string,
  composeRoot: string,
): BuildContextResolution {
  const sourceDir = path.isAbsolute(sourceDirectory)
    ? sourceDirectory
    : path.join(outputDir, sourceDirectory);
  const resolved = path.relative(composeRoot, sourceDir);
  return {
    buildContext: normalizeRelativeForCompose(resolved),
    sourceDirectory: resolved,
  };
}

/**
 * Resolve build context for frontend services from client context.
 */
function resolveFromClientContext(
  clientContext: ClientGenerationContext,
  composeRoot: string,
): BuildContextResolution {
  const generatedRoot = path.join(clientContext.root, "..");
  const resolved = path.relative(composeRoot, generatedRoot);
  return {
    buildContext: normalizeRelativeForCompose(resolved),
    sourceDirectory: resolved,
  };
}

/**
 * Resolve build context using fallback path segments.
 */
function resolveFromFallback(
  sourceDirectory: string,
  composeSegments: string[],
): BuildContextResolution {
  const fallback = buildFallbackComposeContext(sourceDirectory || "", composeSegments);
  return { buildContext: fallback, sourceDirectory: fallback };
}

/**
 * Determine the build context resolution strategy for a service.
 */
function resolveBuildContext(params: BuildContextResolverParams): BuildContextResolution | null {
  const { service, outputDir, composeRoot, composeSegments, clientContext } = params;

  if (service.sourceDirectory) {
    return resolveFromSourceDirectory(service.sourceDirectory, outputDir, composeRoot);
  }

  if (clientContext && (service as { type?: string }).type === "frontend") {
    return resolveFromClientContext(clientContext, composeRoot);
  }

  if (service.language && shouldIncludeComposeBuild(service)) {
    return resolveFromFallback(service.sourceDirectory || "", composeSegments);
  }

  return null;
}

/**
 * Apply resolved build context to a service.
 */
function applyBuildContext(
  service: ComposeServiceConfig,
  resolution: BuildContextResolution | null,
): void {
  if (resolution) {
    service.resolvedBuildContext = resolution.buildContext;
    service.resolvedSourceDirectory = resolution.sourceDirectory;
  }
}

/**
 * Apply default image for external services without explicit image.
 */
function applyDefaultImage(service: ComposeServiceConfig): void {
  if (!service.image && resolveServiceArtifactType(service) === "external") {
    service.image = `${service.name}:latest`;
  }
}

/**
 * Prepare compose services by resolving build contexts and source directories.
 * @param services - Array of compose service configurations
 * @param outputDir - Output directory path
 * @param structure - Project structure configuration
 * @param composeRoot - Root directory for compose files
 * @param composeSegments - Path segments for compose directory
 * @param clientContext - Optional client generation context
 * @returns Array of prepared service configurations
 */
function prepareComposeServices(
  services: ComposeServiceConfig[],
  outputDir: string,
  structure: ProjectStructureConfig,
  composeRoot: string,
  composeSegments: string[],
  clientContext?: ClientGenerationContext,
): ComposeServiceConfig[] {
  return services.map((service) => {
    const resolution = resolveBuildContext({
      service,
      outputDir,
      composeRoot,
      composeSegments,
      clientContext,
    });
    applyBuildContext(service, resolution);
    applyDefaultImage(service);
    return service;
  });
}

/**
 * Determine if a service should include build configuration.
 * @param service - Compose service configuration
 * @returns True if service requires build configuration
 */
function shouldIncludeComposeBuild(service: ComposeServiceConfig): boolean {
  return (
    resolveServiceArtifactType(service) === "internal" ||
    Boolean(service.sourceDirectory) ||
    (service.language && !service.image)
  );
}

/**
 * Generate build context directories and Dockerfiles for services.
 * @param services - Array of compose service configurations
 * @param composeRoot - Root directory for compose files
 * @param options - Generation options
 * @param relativeRoot - Relative path segments for output
 * @param packageManager - Optional package manager command set
 * @returns Array of generated file paths
 */
async function writeServiceConfigFiles(
  service: ComposeServiceConfig,
  composeRoot: string,
  options: GenerateOptions,
  relativeRoot: string[],
): Promise<string[]> {
  if (!service.config?.files) {
    return [];
  }

  const configDir = path.join(composeRoot, "config", service.name);
  await ensureDirectory(configDir, options);
  const files: string[] = [];

  for (const configFile of service.config.files) {
    const content =
      typeof configFile.content === "string"
        ? configFile.content
        : JSON.stringify(configFile.content, null, 2);

    const filePath = path.join(configDir, configFile.name);
    await writeFileWithHooks(filePath, content, options);
    files.push(joinRelativePath(...relativeRoot, "config", service.name, configFile.name));
  }

  return files;
}

async function generateBuildContexts(
  services: ComposeServiceConfig[],
  composeRoot: string,
  options: GenerateOptions,
  relativeRoot: string[],
  packageManager?: PackageManagerCommandSet,
): Promise<string[]> {
  const files: string[] = [];

  for (const service of services) {
    if (resolveServiceArtifactType(service) !== "internal" || !service.resolvedSourceDirectory) {
      continue;
    }

    const buildDir = path.join(composeRoot, "build", service.name);
    await ensureDirectory(buildDir, options);

    if (service.language && shouldIncludeComposeBuild(service)) {
      await writeServiceDockerfile(service, buildDir, options, packageManager);
      files.push(joinRelativePath(...relativeRoot, "build", service.name, "Dockerfile"));
    }

    const configFiles = await writeServiceConfigFiles(service, composeRoot, options, relativeRoot);
    files.push(...configFiles);
  }

  return files;
}

/**
 * Write Dockerfile and dockerignore for a service.
 * @param service - Compose service configuration
 * @param buildDir - Build directory path
 * @param options - Generation options
 * @param packageManager - Optional package manager command set
 */
async function writeServiceDockerfile(
  service: ComposeServiceConfig,
  buildDir: string,
  options: GenerateOptions,
  packageManager?: PackageManagerCommandSet,
): Promise<void> {
  const dockerfileContent = generateServiceDockerfile(service, packageManager);
  const dockerfilePath = path.join(buildDir, "Dockerfile");
  await writeFileWithHooks(dockerfilePath, ensureTrailingNewline(dockerfileContent), options);

  const dockerignorePath = path.join(buildDir, ".dockerignore");
  const dockerignoreContent = `node_modules
dist
build
.cache
.git
.venv
target
*.log
`;
  await writeFileWithHooks(dockerignorePath, ensureTrailingNewline(dockerignoreContent), options);
}

/**
 * Ensure a string ends with a newline character.
 * @param value - Input string
 * @returns String with trailing newline
 */
function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

const LANGUAGE_DOCKERFILE_TEMPLATES: Record<string, (service: ComposeServiceConfig) => string> = {
  python: () => `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "main.py"]`,
  go: () => `FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o app

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /src/app /app/app
CMD ["/app/app"]`,
  rust: (service) => `FROM rust:1.79 as builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {println!(\\"placeholder\\");}" > src/main.rs
RUN cargo fetch
COPY . .
RUN cargo build --release

FROM gcr.io/distroless/cc-debian12
COPY --from=builder /app/target/release/${service.name} /usr/local/bin/${service.name}
ENTRYPOINT ["/usr/local/bin/${service.name}"]`,
};

/**
 * Generate Dockerfile content for a service based on its language.
 * @param service - Compose service configuration
 * @param packageManager - Optional package manager command set
 * @returns Dockerfile content string
 */
function generateServiceDockerfile(
  service: ComposeServiceConfig,
  packageManager?: PackageManagerCommandSet,
): string {
  if (service.language === "typescript" || service.language === "javascript") {
    return buildComposeNodeDockerfile(packageManager);
  }
  const templateFn = service.language ? LANGUAGE_DOCKERFILE_TEMPLATES[service.language] : undefined;
  if (templateFn) return templateFn(service);
  return `FROM ${service.image || "alpine:3.19"}\nCMD ["@/services/generate/start.sh"]`;
}

interface PackageManagerDockerConfig {
  setupLines: string[];
  installCommand: string;
  startArgs: string[];
}

const PM_DOCKER_CONFIGS: Record<string, PackageManagerDockerConfig> = {
  pnpm: {
    setupLines: ["RUN corepack enable pnpm"],
    installCommand: "pnpm install --prod --frozen-lockfile",
    startArgs: ['"pnpm"', '"run"', '"start"'],
  },
  yarn: {
    setupLines: ["RUN corepack enable yarn"],
    installCommand: "yarn install --production --frozen-lockfile",
    startArgs: ['"yarn"', '"start"'],
  },
  bun: {
    setupLines: [
      "RUN curl -fsSL https://bun.sh/install | bash",
      "ENV BUN_INSTALL=/root/.bun",
      "ENV PATH=$BUN_INSTALL/bin:$PATH",
    ],
    installCommand: "bun install --production",
    startArgs: ['"bun"', '"run"', '"start"'],
  },
};

const DEFAULT_PM_CONFIG: PackageManagerDockerConfig = {
  setupLines: [],
  installCommand: "npm install --production",
  startArgs: ['"npm"', '"run"', '"start"'],
};

/**
 * Build Dockerfile content for Node.js/TypeScript services.
 * @param pm - Optional package manager command set
 * @returns Dockerfile content string
 */
function buildComposeNodeDockerfile(pm?: PackageManagerCommandSet): string {
  const config = pm?.name ? (PM_DOCKER_CONFIGS[pm.name] ?? DEFAULT_PM_CONFIG) : DEFAULT_PM_CONFIG;
  return [
    "FROM node:20-alpine",
    "WORKDIR /app",
    ...config.setupLines,
    "COPY package*.json ./",
    `RUN ${config.installCommand}`,
    "COPY . .",
    `CMD [${config.startArgs.join(", ")}]`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildEnvHeader(projectName: string, slug: string): string[] {
  return [
    `# Environment variables for ${projectName}`,
    "# Copy this to .env and customize values",
    "",
    "# Project Configuration",
    `COMPOSE_PROJECT_NAME=${slug}`,
    "COMPOSE_FILE=docker-compose.yml",
    "",
  ];
}

function buildPortOverridesSection(services: ComposeServiceConfig[]): string[] {
  const hostPorts = collectHostPortVariables(services);
  if (hostPorts.length === 0) return [];

  const lines = ["# Port Overrides (host binding)"];
  hostPorts
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(({ name, value }) => lines.push(`${name}=${value}`));
  lines.push("");
  return lines;
}

function buildGlobalEnvSection(deployment?: DeploymentConfig): string[] {
  const globalEnv = Object.entries(deployment?.compose?.environment ?? {});
  if (globalEnv.length === 0) return [];

  const lines = ["# Global Compose environment"];
  globalEnv.forEach(([key, value]) => lines.push(`${key}=${formatEnvValue(value)}`));
  lines.push("");
  return lines;
}

function buildServiceEnvSections(services: ComposeServiceConfig[]): string[] {
  const serviceSections = services
    .filter((service) => service.env && Object.keys(service.env).length > 0)
    .map((service) => {
      const sectionLines = [`# ${service.name} Service`];
      Object.entries(service.env!).forEach(([key, value]) => {
        sectionLines.push(`${key}=${formatEnvValue(value)}`);
      });
      return sectionLines;
    });

  if (serviceSections.length === 0) return [];

  const lines = ["# Service Environment Defaults"];
  serviceSections.forEach((section, index) => {
    lines.push(...section);
    if (index !== serviceSections.length - 1) {
      lines.push("");
    }
  });
  return lines;
}

/**
 * Generate environment template file for Docker Compose.
 * @param services - Array of compose service configurations
 * @param projectName - Project name for the template
 * @param deployment - Optional deployment configuration
 * @returns Environment template file content
 */
function generateComposeEnvTemplate(
  services: ComposeServiceConfig[],
  projectName: string,
  deployment?: DeploymentConfig,
): string {
  const slug = slugify(projectName, projectName).toLowerCase();
  const content = [
    ...buildEnvHeader(projectName, slug),
    ...buildPortOverridesSection(services),
    ...buildGlobalEnvSection(deployment),
    ...buildServiceEnvSections(services),
  ].join("\n");

  return ensureTrailingNewline(content);
}

/**
 * Format a value for use in environment file.
 * @param value - Value to format
 * @returns Formatted string value
 */
function formatEnvValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Collect host port variable names and default values from services.
 * @param services - Array of compose service configurations
 * @returns Array of port variable names and default values
 */
function collectHostPortVariables(
  services: ComposeServiceConfig[],
): Array<{ name: string; value: number }> {
  const entries: Array<{ name: string; value: number }> = [];
  services.forEach((service) => {
    if (!shouldPublishPorts(service) || !service.ports) {
      return;
    }
    service.ports.forEach((port) => {
      entries.push({
        name: buildHostPortVariable(service.name, port.name),
        value: port.port,
      });
    });
  });
  return entries;
}

/**
 * Format a single service section for the compose README
 */
function formatComposeServiceSection(service: ComposeServiceConfig): string {
  const artifactType = resolveServiceArtifactType(service);
  const workload = service.workload || resolveServiceWorkload(service) || "deployment";

  const sourceInfo =
    artifactType === "internal"
      ? `- **Source**: ${service.resolvedSourceDirectory || service.sourceDirectory || "Built from local source"}`
      : `- **Image**: ${service.image || "managed externally"}`;

  const portsInfo = service.ports
    ? `\n- **Ports**: ${service.ports.map((p) => `${p.port}:${p.targetPort || p.port}`).join(", ")}`
    : "";

  const volumeInfo = service.volumes
    ? `\n- **Volumes**: ${service.volumes.map((v) => `${v.name} → ${v.path}`).join(", ")}`
    : "";

  return `### ${service.name} (${artifactType})
- **Language**: ${service.language}
- **Workload**: ${workload}
${sourceInfo}${portsInfo}${volumeInfo}`;
}

/**
 * Format build commands for internal services
 */
function formatBuildCommands(services: ComposeServiceConfig[]): string {
  return services
    .filter((s) => resolveServiceArtifactType(s) === "internal")
    .map((s) => `docker compose build ${s.name}`)
    .join("\n");
}

/**
 * Format access URLs for services with ports
 */
function formatAccessUrls(services: ComposeServiceConfig[]): string {
  return services
    .filter((s) => s.ports && s.ports.length > 0)
    .map((service) => `\n**${service.name}**: http://localhost:${service.ports?.[0].port}`)
    .join("");
}

/**
 * Format scale commands for all services
 */
function formatScaleCommands(services: ComposeServiceConfig[]): string {
  return services
    .map((s) => `docker compose up -d --scale ${s.name}=${s.replicas || 1}`)
    .join("\n");
}

function generateComposeReadme(
  services: ComposeServiceConfig[],
  deployment: DeploymentConfig,
  projectName: string,
): string {
  const servicesSections = services.map(formatComposeServiceSection).join("\n\n");
  const buildCommands = formatBuildCommands(services);
  const accessUrls = formatAccessUrls(services);
  const scaleCommands = formatScaleCommands(services);

  return `# ${projectName} - Docker Compose Deployment

This directory contains Docker Compose configurations for running ${projectName} locally.

## Prerequisites

- [Docker](https://docker.com) with Compose plugin
- [Docker Compose](https://docs.docker.com/compose/) v2.0+

## Services

${servicesSections}

## Quick Start

### 1. Setup Environment
\`\`\`bash
cp .env.template .env
# Edit .env with your configuration
\`\`\`

### 2. Build and Start Services
\`\`\`bash
docker compose up --build -d
\`\`\`

### 3. View Logs
\`\`\`bash
docker compose logs -f
\`\`\`

### 4. Stop Services
\`\`\`bash
docker compose down
\`\`\`

## Service Management

### Build specific service
\`\`\`bash
${buildCommands}
\`\`\`

### Access services
${accessUrls}

### Scale services
\`\`\`bash
${scaleCommands}
\`\`\`

## Development Workflow

### For internal services
1. Make code changes in source directories
2. Rebuild specific services: \`docker compose build <service>\`
3. Restart: \`docker compose up -d <service>\`

### For configuration changes
1. Update files in \`./config/\` directories
2. Restart affected services: \`docker compose restart <service>\`

## Debugging

### Check service status
\`\`\`bash
docker compose ps
\`\`\`

### View service logs
\`\`\`bash
docker compose logs <service-name>
docker compose logs -f <service-name>  # Follow logs
\`\`\`

### Execute commands in containers
\`\`\`bash
docker compose exec <service-name> sh
\`\`\`

### Health Checks

Docker Compose files include health checks for services exposing HTTP ports. Adjust the \`.env\`
file to change health paths or ports.

## Environment

- Primary compose file: \`docker-compose.yml\`
- Environment template: \`.env.template\`
- Generated configs: \`./config/<service>/\`
- Custom build contexts: \`./build/<service>/\`

## Deployment Notes

- This setup is intended for local development and QA environments
- Use secrets management for production credentials
- Review generated Dockerfiles under \`./build/\` before publishing

`;
}

/**
 * Generate docker-compose.yml file content.
 * @param services - Array of compose service configurations
 * @param deployment - Deployment configuration
 * @param projectName - Project name
 * @returns Docker Compose YAML content string
 */
function generateDockerComposeFile(
  services: ComposeServiceConfig[],
  deployment: DeploymentConfig,
  projectName: string,
): string {
  const version = deployment.compose?.version;
  let compose = "";

  if (version && version !== "auto") {
    compose += `version: "${version}"\n\n`;
  }

  compose += `services:
${services.map((service) => generateComposeService(service, projectName)).join("\n")}`;

  if (deployment.compose?.networks && Object.keys(deployment.compose.networks).length > 0) {
    compose += `

networks:
${Object.entries(deployment.compose.networks)
  .map(
    ([name, config]) =>
      `  ${name}:
${Object.entries(config as any)
  .map(([k, v]) => `    ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
  .join("\n")}`,
  )
  .join("\n")}`;
  }

  const namedVolumes = services.flatMap((s) =>
    (s.volumes || [])
      .filter((v) => v.type === "persistentVolumeClaim")
      .map((v) => `${s.name}_${v.name}`),
  );

  const uniqueNamedVolumes = Array.from(new Set(namedVolumes));

  if (uniqueNamedVolumes.length > 0) {
    compose += `

volumes:
${uniqueNamedVolumes.map((volume) => `  ${volume}:`).join("\n")}`;
  }

  return compose;
}

/**
 * Normalize a relative path for use in Docker Compose files.
 * @param value - Relative path to normalize
 * @returns Normalized path with forward slashes
 */
function normalizeRelativeForCompose(value: string): string {
  if (!value || value === ".") {
    return ".";
  }

  return value.split(path.sep).join("/");
}

/**
 * Build a fallback build context path for compose services.
 * @param value - Source directory value
 * @param composeSegments - Compose directory path segments
 * @returns Relative path to build context
 */
function buildFallbackComposeContext(value: string, composeSegments: string[]): string {
  const ups = new Array(composeSegments.length).fill("..");
  const segments = value.split(path.sep).filter(Boolean);
  return joinRelativePath(...ups, ...segments);
}
