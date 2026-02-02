/**
 * @packageDocumentation
 * Docker configuration file generator.
 *
 * Generates Dockerfiles, docker-compose configurations, and
 * related container orchestration files for services and clients.
 */

import path from "node:path";
import type {
  ClientGenerationTarget,
  ServiceGenerationTarget,
} from "@/services/generate/io/contexts.js";
import { writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import { joinRelativePath } from "@/services/generate/util/shared.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { CLIConfig, ProjectStructureConfig } from "@/types.js";
import type { PackageManagerCommandSet } from "@/utils/io/package-manager.js";
import type { AppSpec } from "@arbiter/specification";
import chalk from "chalk";
import fs from "fs-extra";

export interface DockerTemplateSelection {
  dockerfile?: string;
  dockerignore?: string;
}

export interface DockerMetadata {
  language: string;
  ports: number[];
  packageManager?: string;
  installCommand?: string;
  buildCommand?: string;
  startCommand?: string;
  baseImage?: string;
  env?: Record<string, string>;
}

export async function generateServiceDockerArtifacts(
  serviceTarget: ServiceGenerationTarget,
  serviceSpec: any,
  options: GenerateOptions,
  cliConfig: CLIConfig,
  _structure: ProjectStructureConfig,
  packageManager: PackageManagerCommandSet,
): Promise<string[]> {
  const language = serviceTarget.language;
  const context = serviceTarget.context;
  const override = resolveDockerTemplateSelection(cliConfig, "service", language);
  const metadata = deriveServiceDockerMetadata(
    language,
    serviceTarget,
    serviceSpec,
    packageManager,
  );
  const defaults = buildDefaultServiceDockerArtifacts(metadata);

  if (!override && !defaults) {
    return [];
  }

  const dockerfileContent = override?.dockerfile
    ? await loadDockerTemplateContent(override.dockerfile, cliConfig)
    : defaults?.dockerfile;

  const dockerignoreContent = override?.dockerignore
    ? await loadDockerTemplateContent(override.dockerignore, cliConfig)
    : defaults?.dockerignore;

  const written: string[] = [];

  if (dockerfileContent) {
    const dockerfilePath = path.join(context.root, "Dockerfile");
    await writeFileWithHooks(dockerfilePath, ensureTrailingNewline(dockerfileContent), options);
    written.push("Dockerfile");
  }

  if (dockerignoreContent) {
    const dockerignorePath = path.join(context.root, ".dockerignore");
    await writeFileWithHooks(dockerignorePath, ensureTrailingNewline(dockerignoreContent), options);
    written.push(".dockerignore");
  }

  return written;
}

export async function generateClientDockerArtifacts(
  clientTarget: ClientGenerationTarget,
  appSpec: AppSpec,
  options: GenerateOptions,
  cliConfig: CLIConfig,
  packageManager: PackageManagerCommandSet,
): Promise<string[]> {
  const language = appSpec.config?.language?.toLowerCase() || "typescript";
  const override = resolveDockerTemplateSelection(cliConfig, "client", language);
  const metadata = deriveClientDockerMetadata(language, clientTarget, packageManager);
  const defaults = buildDefaultClientDockerArtifacts(metadata);

  if (!override && !defaults) {
    return [];
  }

  const dockerfileContent = override?.dockerfile
    ? await loadDockerTemplateContent(override.dockerfile, cliConfig)
    : defaults?.dockerfile;

  const dockerignoreContent = override?.dockerignore
    ? await loadDockerTemplateContent(override.dockerignore, cliConfig)
    : defaults?.dockerignore;

  const written: string[] = [];

  if (dockerfileContent) {
    const dockerfilePath = path.join(clientTarget.context.root, "Dockerfile");
    await writeFileWithHooks(dockerfilePath, ensureTrailingNewline(dockerfileContent), options);
    written.push("Dockerfile");
  }

  if (dockerignoreContent) {
    const dockerignorePath = path.join(clientTarget.context.root, ".dockerignore");
    await writeFileWithHooks(dockerignorePath, ensureTrailingNewline(dockerignoreContent), options);
    written.push(".dockerignore");
  }

  return written;
}

function findCatalogEntry(
  catalog: Record<string, DockerTemplateSelection> | undefined,
  identifier: string,
  normalizedId: string,
): DockerTemplateSelection | undefined {
  if (!catalog) {
    return undefined;
  }

  const directMatch = catalog[normalizedId] ?? catalog[identifier];
  if (directMatch) {
    return directMatch;
  }

  for (const [key, value] of Object.entries(catalog)) {
    if (key.toLowerCase() === normalizedId) {
      return value;
    }
  }

  return undefined;
}

function resolveDockerTemplateSelection(
  cliConfig: CLIConfig,
  kind: "service" | "client",
  identifier: string,
): DockerTemplateSelection | null {
  const dockerConfig = cliConfig.generator?.docker;
  if (!dockerConfig) {
    return null;
  }

  const normalizedId = identifier.toLowerCase();
  const defaults =
    kind === "service" ? dockerConfig.defaults?.service : dockerConfig.defaults?.client;
  const catalog = kind === "service" ? dockerConfig.services : dockerConfig.clients;

  const baseSelection = defaults ? { ...defaults } : undefined;
  const catalogEntry = findCatalogEntry(catalog, identifier, normalizedId);

  if (!baseSelection && !catalogEntry) {
    return null;
  }

  return { ...(baseSelection ?? {}), ...catalogEntry };
}

async function loadDockerTemplateContent(
  templatePath: string,
  cliConfig: CLIConfig,
): Promise<string> {
  const baseDir = cliConfig.configDir || cliConfig.projectDir || process.cwd();
  const resolved = path.isAbsolute(templatePath)
    ? templatePath
    : path.resolve(baseDir, templatePath);

  try {
    return await fs.readFile(resolved, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read Docker template at ${resolved}: ${message}`);
  }
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

type DockerArtifactBuilder = (metadata: DockerMetadata) => DockerTemplateSelection;

const SERVICE_DOCKER_BUILDERS: Record<string, DockerArtifactBuilder> = {
  typescript: buildTypeScriptServiceDockerArtifacts,
  javascript: buildTypeScriptServiceDockerArtifacts,
  python: buildPythonServiceDockerArtifacts,
  go: buildGoServiceDockerArtifacts,
  rust: buildRustServiceDockerArtifacts,
};

export function buildDefaultServiceDockerArtifacts(
  metadata: DockerMetadata,
): DockerTemplateSelection | null {
  const builder = SERVICE_DOCKER_BUILDERS[metadata.language];
  if (builder) return builder(metadata);
  console.log(
    chalk.dim(
      `    Skipping Dockerfile generation for unsupported service language '${metadata.language}'.`,
    ),
  );
  return null;
}

const CLIENT_DOCKER_BUILDERS: Record<string, DockerArtifactBuilder> = {
  typescript: buildTypeScriptClientDockerArtifacts,
  javascript: buildTypeScriptClientDockerArtifacts,
};

export function buildDefaultClientDockerArtifacts(
  metadata: DockerMetadata,
): DockerTemplateSelection | null {
  const builder = CLIENT_DOCKER_BUILDERS[metadata.language];
  if (builder) return builder(metadata);
  console.log(
    chalk.dim(
      `    Skipping client Dockerfile generation for unsupported language '${metadata.language}'.`,
    ),
  );
  return null;
}

export function getPrimaryServicePort(serviceSpec: any, fallback: number): number {
  const ports = Array.isArray(serviceSpec?.ports) ? serviceSpec.ports : [];
  if (ports.length === 0) {
    return fallback;
  }

  const portEntry = ports[0];
  const candidate = Number(portEntry?.targetPort ?? portEntry?.port);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : fallback;
}

export function deriveServiceDockerMetadata(
  language: string,
  target: ServiceGenerationTarget,
  serviceSpec: any,
  packageManager: PackageManagerCommandSet,
): DockerMetadata {
  const port = getPrimaryServicePort(serviceSpec, 3000);
  return {
    language,
    ports: [port],
    packageManager: packageManager.name,
    env: { slug: target.slug },
  };
}

export function deriveClientDockerMetadata(
  language: string,
  _target: ClientGenerationTarget,
  packageManager: PackageManagerCommandSet,
): DockerMetadata {
  return {
    language,
    ports: [4173],
    packageManager: packageManager.name,
  };
}

interface PackageManagerDockerCommands {
  setupLines: string[];
  installCommand: string;
  pruneCommand: string;
  buildCommand: string;
}

const PM_DOCKER_COMMANDS: Record<string, PackageManagerDockerCommands> = {
  pnpm: {
    setupLines: ["RUN corepack enable pnpm"],
    installCommand: "pnpm install --frozen-lockfile",
    pruneCommand: "pnpm prune --prod",
    buildCommand: "pnpm run build",
  },
  yarn: {
    setupLines: ["RUN corepack enable yarn"],
    installCommand: "yarn install --frozen-lockfile",
    pruneCommand: "yarn workspaces focus --production",
    buildCommand: "yarn run build",
  },
  bun: {
    setupLines: [
      "RUN curl -fsSL https://bun.sh/install | bash",
      "ENV BUN_INSTALL=/root/.bun",
      "ENV PATH=$BUN_INSTALL/bin:$PATH",
    ],
    installCommand: "bun install",
    pruneCommand: "bun install --production",
    buildCommand: "bun run build",
  },
};

const DEFAULT_PM_COMMANDS: PackageManagerDockerCommands = {
  setupLines: [],
  installCommand: "npm install",
  pruneCommand: "npm prune --production",
  buildCommand: "npm run build",
};

function getPackageManagerCommands(pm?: string): PackageManagerDockerCommands {
  return pm ? (PM_DOCKER_COMMANDS[pm] ?? DEFAULT_PM_COMMANDS) : DEFAULT_PM_COMMANDS;
}

function buildTypeScriptServiceDockerArtifacts(metadata: DockerMetadata): DockerTemplateSelection {
  const port = metadata.ports[0] ?? 3000;
  const packageManager = metadata.packageManager ?? "npm";
  const pmCommands = getPackageManagerCommands(packageManager);

  const dockerfile = `
FROM node:20-alpine AS base
WORKDIR /app
${pmCommands.setupLines.map((line) => `${line}`).join("\n")}
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* bun.lockb* ./
RUN ${pmCommands.installCommand}
COPY . .
RUN ${pmCommands.pruneCommand}
EXPOSE ${port}
CMD ["${packageManager === "bun" ? "bun" : "npm"}", "run", "start"]
`;

  const dockerignore = `
node_modules
npm-debug.log
dist
build
.arbiter
`;

  return {
    dockerfile,
    dockerignore,
  };
}

function buildPythonServiceDockerArtifacts(_metadata: DockerMetadata): DockerTemplateSelection {
  const dockerfile = `
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]
`;
  const dockerignore = `
__pycache__
.pytest_cache
.venv
*.pyc
`;
  return { dockerfile, dockerignore };
}

function buildGoServiceDockerArtifacts(_metadata: DockerMetadata): DockerTemplateSelection {
  const dockerfile = `
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o server ./cmd/server

FROM alpine:3.18
WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 8080
CMD ["@/services/generate/server"]
`;
  const dockerignore = `
bin
dist
*.exe
`;
  return { dockerfile, dockerignore };
}

function buildRustServiceDockerArtifacts(metadata: DockerMetadata): DockerTemplateSelection {
  const dockerfile = `
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:stable-slim
WORKDIR /app
COPY --from=builder /app/target/release/${metadata.env?.slug ?? "app"} /app/${metadata.env?.slug ?? "app"}
EXPOSE 8080
CMD ["/app/${metadata.env?.slug ?? "app"}"]
`;
  const dockerignore = `
target
*.rs.bk
`;
  return { dockerfile, dockerignore };
}

function buildTypeScriptClientDockerArtifacts(metadata: DockerMetadata): DockerTemplateSelection {
  const packageManager = metadata.packageManager ?? "npm";
  const pmCommands = getPackageManagerCommands(packageManager);

  const dockerfile = `
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* bun.lockb* ./
RUN ${pmCommands.installCommand}
COPY . .
RUN ${pmCommands.buildCommand}
EXPOSE 4173
CMD ["npm","run","preview","--","--host","0.0.0.0","--port","4173"]
`;

  const dockerignore = `
node_modules
.arbiter
dist
build
npm-debug.log
`;

  return { dockerfile, dockerignore };
}
