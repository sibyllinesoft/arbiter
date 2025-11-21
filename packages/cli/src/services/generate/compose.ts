import path from "node:path";
import type {
  DeploymentConfig,
  ServiceConfig as DeploymentServiceConfig,
  ServiceDeploymentOverride,
} from "@arbiter/shared";
import fs from "fs-extra";
import type { ProjectStructureConfig } from "../../types.js";
import type { PackageManagerCommandSet } from "../../utils/package-manager.js";
import {
  resolveServiceArtifactType,
  resolveServiceWorkload,
} from "../../utils/service-metadata.js";
import type { ClientGenerationContext } from "./contexts.js";
import { ensureDirectory, writeFileWithHooks } from "./hook-executor.js";
import { joinRelativePath, slugify, toPathSegments } from "./shared.js";
import type { GenerateOptions } from "./types.js";

type ComposeServiceConfig = DeploymentServiceConfig & {
  resolvedBuildContext?: string;
  resolvedSourceDirectory?: string;
  dependencies?: string[];
  profiles?: string[];
  healthCheck?: {
    path?: string;
    interval?: string;
    timeout?: string;
  };
  readinessProbe?: {
    httpGet?: { path?: string };
    periodSeconds?: number;
    timeoutSeconds?: number;
  };
  livenessProbe?: {
    httpGet?: { path?: string };
    periodSeconds?: number;
    timeoutSeconds?: number;
  };
  startupProbe?: {
    httpGet?: { path?: string };
    periodSeconds?: number;
    timeoutSeconds?: number;
  };
  config?: {
    files?: Array<{
      name: string;
      content: string | Record<string, unknown>;
    }>;
  };
  scaling?: Record<string, unknown>;
  workload?: string;
};

const CLIENT_COMPONENT_LABEL = "arbiter.io/component";

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

function selectComposeDeployment(cueData: any): ComposeDeploymentSelection {
  const deployments = cueData?.deployments;
  if (deployments && typeof deployments === "object") {
    const entries = Object.entries(deployments as Record<string, DeploymentConfig>);
    const match = entries.find(([, cfg]) => cfg?.target === "compose") || entries[0];
    if (match) {
      const [environment, config] = match;
      const overrides =
        (config?.services && typeof config.services === "object"
          ? (config.services as Record<string, ServiceDeploymentOverride>)
          : {}) ?? {};
      return {
        deployment: { ...config, environment },
        overrides,
      };
    }
  }

  return {
    deployment: null,
    overrides: {},
  };
}

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

export function parseDockerComposeServices(
  assemblyConfig: any,
  context?: ComposeDeploymentContext,
): {
  services: ComposeServiceConfig[];
  deployment: DeploymentConfig | null;
} {
  const services: ComposeServiceConfig[] = [];
  const cueData = assemblyConfig._fullCueData || assemblyConfig;

  let deployment = context?.deployment ?? null;
  let overrides = context?.overrides ?? undefined;

  if (!deployment) {
    const selection = selectComposeDeployment(cueData);
    deployment = selection.deployment;
    overrides = selection.overrides;
  }

  if (!deployment) {
    return { services: [], deployment: null };
  }

  const composeVersion = deployment?.compose?.version;
  const resolvedDeployment: DeploymentConfig = {
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

  if (cueData?.services) {
    for (const [serviceName, serviceConfig] of Object.entries(cueData.services)) {
      const merged = applyComposeOverrides(
        serviceConfig as Record<string, unknown>,
        overrides?.[serviceName],
      );
      const service = parseServiceForCompose(serviceName, merged as any);
      if (service) {
        services.push(service);
      }
    }
  }

  return { services, deployment: resolvedDeployment };
}

function parseServiceForCompose(name: string, config: any): ComposeServiceConfig | null {
  const artifactType = resolveServiceArtifactType(config);
  const workload = resolveServiceWorkload(config) || config.workload || "deployment";

  const service: ComposeServiceConfig = {
    name: name,
    type: artifactType,
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

function collectServiceEnvironmentVariables(config: any): Record<string, string> {
  const env: Record<string, string> = {};

  if (config.env && typeof config.env === "object") {
    Object.assign(env, config.env);
  }

  if (config.environment && typeof config.environment === "object") {
    Object.assign(env, config.environment);
  }

  if (config.envFrom && Array.isArray(config.envFrom)) {
    config.envFrom.forEach((source: any) => {
      if (source.secretRef?.name) {
        env[`SECRET_${slugify(source.secretRef.name, "secret").toUpperCase()}`] =
          `\${${source.secretRef.name.toUpperCase()}_SECRET}`;
      }
      if (source.configMapRef?.name) {
        env[`CONFIG_${slugify(source.configMapRef.name, "config").toUpperCase()}`] =
          `\${${source.configMapRef.name.toUpperCase()}_CONFIG}`;
      }
    });
  }

  return env;
}

function prepareComposeServices(
  services: ComposeServiceConfig[],
  outputDir: string,
  structure: ProjectStructureConfig,
  composeRoot: string,
  composeSegments: string[],
  clientContext?: ClientGenerationContext,
): ComposeServiceConfig[] {
  return services.map((service) => {
    if (service.sourceDirectory) {
      const sourceDir = path.isAbsolute(service.sourceDirectory)
        ? service.sourceDirectory
        : path.join(outputDir, service.sourceDirectory);

      const resolved = path.relative(composeRoot, sourceDir);
      service.resolvedBuildContext = normalizeRelativeForCompose(resolved);
      service.resolvedSourceDirectory = resolved;
    } else if (clientContext && (service as { type?: string }).type === "frontend") {
      const generatedRoot = path.join(clientContext.root, "..");
      service.resolvedBuildContext = normalizeRelativeForCompose(
        path.relative(composeRoot, generatedRoot),
      );
      service.resolvedSourceDirectory = path.relative(composeRoot, generatedRoot);
    } else if (service.language && shouldIncludeComposeBuild(service)) {
      const fallback = buildFallbackComposeContext(service.sourceDirectory || "", composeSegments);
      service.resolvedBuildContext = fallback;
      service.resolvedSourceDirectory = fallback;
    }

    if (!service.image && resolveServiceArtifactType(service) === "external") {
      service.image = `${service.name}:latest`;
    }

    return service;
  });
}

function shouldIncludeComposeBuild(service: ComposeServiceConfig): boolean {
  return (
    resolveServiceArtifactType(service) === "internal" ||
    Boolean(service.sourceDirectory) ||
    (service.language && !service.image)
  );
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
    if (resolveServiceArtifactType(service) === "internal" && service.resolvedSourceDirectory) {
      const buildDir = path.join(composeRoot, "build", service.name);
      await ensureDirectory(buildDir, options);

      if (service.language && shouldIncludeComposeBuild(service)) {
        await writeServiceDockerfile(service, buildDir, options, packageManager);
        files.push(joinRelativePath(...relativeRoot, "build", service.name, "Dockerfile"));
      }

      if (service.config?.files) {
        const configDir = path.join(composeRoot, "config", service.name);
        await ensureDirectory(configDir, options);

        for (const configFile of service.config.files) {
          const content =
            typeof configFile.content === "string"
              ? configFile.content
              : JSON.stringify(configFile.content, null, 2);

          const filePath = path.join(configDir, configFile.name);
          await writeFileWithHooks(filePath, content, options);
          files.push(joinRelativePath(...relativeRoot, "config", service.name, configFile.name));
        }
      }
    }
  }

  return files;
}

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

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function generateServiceDockerfile(
  service: ComposeServiceConfig,
  packageManager?: PackageManagerCommandSet,
): string {
  switch (service.language) {
    case "typescript":
    case "javascript":
      return buildComposeNodeDockerfile(packageManager);
    case "python":
      return `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "main.py"]`;
    case "go":
      return `FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o app

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /src/app /app/app
CMD ["/app/app"]`;
    case "rust":
      return `FROM rust:1.79 as builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {println!(\\"placeholder\\");}" > src/main.rs
RUN cargo fetch
COPY . .
RUN cargo build --release

FROM gcr.io/distroless/cc-debian12
COPY --from=builder /app/target/release/${service.name} /usr/local/bin/${service.name}
ENTRYPOINT ["/usr/local/bin/${service.name}"]`;
    default:
      return `FROM ${service.image || "alpine:3.19"}
CMD ["./start.sh"]`;
  }
}

function buildComposeNodeDockerfile(pm?: PackageManagerCommandSet): string {
  const setupLines: string[] = [];
  switch (pm?.name) {
    case "pnpm":
      setupLines.push("RUN corepack enable pnpm");
      break;
    case "yarn":
      setupLines.push("RUN corepack enable yarn");
      break;
    case "bun":
      setupLines.push("RUN curl -fsSL https://bun.sh/install | bash");
      setupLines.push("ENV BUN_INSTALL=/root/.bun");
      setupLines.push("ENV PATH=$BUN_INSTALL/bin:$PATH");
      break;
    default:
      break;
  }

  const installCommand = (() => {
    switch (pm?.name) {
      case "pnpm":
        return "pnpm install --prod --frozen-lockfile";
      case "yarn":
        return "yarn install --production --frozen-lockfile";
      case "bun":
        return "bun install --production";
      default:
        return "npm install --production";
    }
  })();

  const startArgs = (() => {
    switch (pm?.name) {
      case "pnpm":
        return ['"pnpm"', '"run"', '"start"'];
      case "yarn":
        return ['"yarn"', '"start"'];
      case "bun":
        return ['"bun"', '"run"', '"start"'];
      default:
        return ['"npm"', '"run"', '"start"'];
    }
  })();

  return [
    "FROM node:20-alpine",
    "WORKDIR /app",
    ...setupLines,
    "COPY package*.json ./",
    `RUN ${installCommand}`,
    "COPY . .",
    `CMD [${startArgs.join(", ")}]`,
  ]
    .filter(Boolean)
    .join("\n");
}

function generateComposeEnvTemplate(
  services: ComposeServiceConfig[],
  projectName: string,
  deployment?: DeploymentConfig,
): string {
  const slug = slugify(projectName, projectName).toLowerCase();
  const lines: string[] = [];
  const addBlankLine = () => {
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("");
    }
  };

  lines.push(`# Environment variables for ${projectName}`);
  lines.push("# Copy this to .env and customize values");
  addBlankLine();

  lines.push("# Project Configuration");
  lines.push(`COMPOSE_PROJECT_NAME=${slug}`);
  lines.push("COMPOSE_FILE=docker-compose.yml");
  addBlankLine();

  const hostPorts = collectHostPortVariables(services);
  if (hostPorts.length > 0) {
    lines.push("# Port Overrides (host binding)");
    hostPorts
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(({ name, value }) => lines.push(`${name}=${value}`));
    addBlankLine();
  }

  const globalEnv = Object.entries(deployment?.compose?.environment ?? {});
  if (globalEnv.length > 0) {
    lines.push("# Global Compose environment");
    globalEnv.forEach(([key, value]) => lines.push(`${key}=${formatEnvValue(value)}`));
    addBlankLine();
  }

  const serviceSections = services
    .map((service) => {
      if (!service.env || Object.keys(service.env).length === 0) {
        return null;
      }
      const sectionLines = [`# ${service.name} Service`];
      Object.entries(service.env).forEach(([key, value]) => {
        sectionLines.push(`${key}=${formatEnvValue(value)}`);
      });
      return sectionLines;
    })
    .filter((section): section is string[] => Array.isArray(section));

  if (serviceSections.length > 0) {
    lines.push("# Service Environment Defaults");
    serviceSections.forEach((section, index) => {
      lines.push(...section);
      if (index !== serviceSections.length - 1) {
        lines.push("");
      }
    });
  }

  return ensureTrailingNewline(lines.join("\n"));
}

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

function buildHostPortVariable(serviceName: string, portName?: string): string {
  const normalizedService = serviceName.replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
  const normalizedPort =
    portName && portName !== "http"
      ? `_${portName.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`
      : "";
  return `${normalizedService}${normalizedPort}_PORT`;
}

function generateComposeReadme(
  services: ComposeServiceConfig[],
  deployment: DeploymentConfig,
  projectName: string,
): string {
  return `# ${projectName} - Docker Compose Deployment

This directory contains Docker Compose configurations for running ${projectName} locally.

## Prerequisites

- [Docker](https://docker.com) with Compose plugin
- [Docker Compose](https://docs.docker.com/compose/) v2.0+

## Services

${services
  .map((service) => {
    const artifactType = resolveServiceArtifactType(service);
    const workload = service.workload || resolveServiceWorkload(service) || "deployment";
    const sourceInfo =
      artifactType === "internal"
        ? `- **Source**: ${
            service.resolvedSourceDirectory || service.sourceDirectory || "Built from local source"
          }`
        : `- **Image**: ${service.image || "managed externally"}`;
    const portsInfo = service.ports
      ? `
- **Ports**: ${service.ports.map((p) => `${p.port}:${p.targetPort || p.port}`).join(", ")}`
      : "";
    const volumeInfo = service.volumes
      ? `
- **Volumes**: ${service.volumes.map((v) => `${v.name} → ${v.path}`).join(", ")}`
      : "";
    return `### ${service.name} (${artifactType})
- **Language**: ${service.language}
- **Workload**: ${workload}
${sourceInfo}${portsInfo}${volumeInfo}`;
  })
  .join("\n\n")}

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
${services
  .filter((s) => resolveServiceArtifactType(s) === "internal")
  .map((s) => `docker compose build ${s.name}`)
  .join("\n")}
\`\`\`

### Access services
${services
  .filter((s) => s.ports && s.ports.length > 0)
  .map(
    (service) => `
**${service.name}**: http://localhost:${service.ports?.[0].port}`,
  )
  .join("")}

### Scale services
\`\`\`bash
${services.map((s) => `docker compose up -d --scale ${s.name}=${s.replicas || 1}`).join("\n")}
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

function shouldPublishPorts(service: ComposeServiceConfig): boolean {
  const workload = service.workload || resolveServiceWorkload(service) || "deployment";
  return !(workload === "statefulset" && resolveServiceArtifactType(service) === "external");
}

function resolveHealthConfiguration(
  service: ComposeServiceConfig,
  port: number,
): {
  path: string;
  interval: string;
  timeout: string;
} {
  const isClientComponent =
    service.labels?.[CLIENT_COMPONENT_LABEL] === "client" ||
    service.name.toLowerCase().includes("client");
  if (isClientComponent) {
    return {
      path: "/",
      interval: "30s",
      timeout: "5s",
    };
  }

  const probe = service.readinessProbe || service.livenessProbe || service.startupProbe;
  if (probe?.httpGet?.path) {
    return {
      path: probe.httpGet.path,
      interval: probe.periodSeconds ? `${probe.periodSeconds}s` : "30s",
      timeout: probe.timeoutSeconds ? `${probe.timeoutSeconds}s` : "5s",
    };
  }

  return {
    path: service.healthCheck?.path || "healthz",
    interval: service.healthCheck?.interval || "30s",
    timeout: service.healthCheck?.timeout || "5s",
  };
}

function generateComposeService(service: ComposeServiceConfig, projectName: string): string {
  const serviceName = service.name;
  let serviceConfig = `  ${serviceName}:`;

  if (resolveServiceArtifactType(service) === "internal") {
    if (service.resolvedBuildContext) {
      serviceConfig += `
    build:
      context: ${service.resolvedBuildContext}`;

      if (service.buildContext?.dockerfile) {
        serviceConfig += `
      dockerfile: ${service.buildContext.dockerfile}`;
      }

      if (service.buildContext?.target) {
        serviceConfig += `
      target: ${service.buildContext.target}`;
      }

      if (service.buildContext?.buildArgs) {
        serviceConfig += `
      args:
${Object.entries(service.buildContext.buildArgs)
  .map(([k, v]) => `        ${k}: ${v}`)
  .join("\n")}`;
      }
    } else {
      serviceConfig += `
    image: ${service.image || `${serviceName}:latest`}`;
    }
  } else {
    serviceConfig += `
    image: ${service.image}`;
  }

  serviceConfig += `
    container_name: ${projectName}_${serviceName}
    restart: unless-stopped`;

  if (shouldPublishPorts(service) && service.ports && service.ports.length > 0) {
    serviceConfig += `
    ports:
${service.ports
  .map((p) => {
    const hostVar = buildHostPortVariable(service.name, p.name);
    return `      - "\${${hostVar}:-${p.port}}:${p.targetPort || p.port}"`;
  })
  .join("\n")}`;
  }

  if (service.env && Object.keys(service.env).length > 0) {
    serviceConfig += `
    environment:
${Object.entries(service.env)
  .map(([k, v]) => `      ${k}: ${v}`)
  .join("\n")}`;
  }

  if (service.dependencies && service.dependencies.length > 0) {
    serviceConfig += `
    depends_on:
${service.dependencies.map((dependency) => `      - ${dependency}`).join("\n")}`;
  }

  if (service.volumes && service.volumes.length > 0) {
    serviceConfig += `
    volumes:`;

    service.volumes.forEach((volume) => {
      if (volume.type === "persistentVolumeClaim") {
        serviceConfig += `
      - ${serviceName}_${volume.name}:${volume.path}`;
      } else if (volume.type === "configMap" && service.config?.files) {
        const configFile = service.config.files.find((f) => f.name === volume.name);
        if (configFile) {
          serviceConfig += `
      - ./config/${serviceName}/${configFile.name}:${volume.path}:ro`;
        }
      } else {
        serviceConfig += `
      - ${volume.name}:${volume.path}`;
      }
    });
  }

  const labels = {
    project: projectName,
    service: serviceName,
    "service-type": resolveServiceArtifactType(service),
    ...service.labels,
  };

  serviceConfig += `
    labels:
${Object.entries(labels)
  .map(([k, v]) => `      ${k}: "${v}"`)
  .join("\n")}`;

  if (service.ports && service.ports.length > 0) {
    const httpPort = service.ports.find((p) => p.name === "http" || p.name === "web");
    if (httpPort) {
      const resolvedPort = httpPort.targetPort || httpPort.port;
      const healthConfig = resolveHealthConfiguration(service, resolvedPort);
      const healthPath = healthConfig.path.startsWith("/")
        ? healthConfig.path
        : `/${healthConfig.path}`;
      serviceConfig += `
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${resolvedPort}${healthPath}"]
      interval: ${healthConfig.interval}
      timeout: ${healthConfig.timeout}
      retries: 3`;
    }
  }

  if (service.resources?.limits) {
    const limits = service.resources.limits;
    if (limits.memory) {
      serviceConfig += `
    mem_limit: ${limits.memory.replace("Mi", "m").replace("Gi", "g")}`;
    }
    if (limits.cpu) {
      const cpuLimit = limits.cpu.replace("m", "");
      const cpuFloat = (Number.parseInt(cpuLimit) / 1000).toFixed(2);
      serviceConfig += `
    cpus: "${cpuFloat}"`;
    }
  }

  return serviceConfig;
}

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

function normalizeRelativeForCompose(value: string): string {
  if (!value || value === ".") {
    return ".";
  }

  return value.split(path.sep).join("/");
}

function buildFallbackComposeContext(value: string, composeSegments: string[]): string {
  const ups = new Array(composeSegments.length).fill("..");
  const segments = value.split(path.sep).filter(Boolean);
  return joinRelativePath(...ups, ...segments);
}
