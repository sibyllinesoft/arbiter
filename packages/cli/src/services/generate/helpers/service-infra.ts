/**
 * @packageDocumentation
 * Service infrastructure artifact generation.
 *
 * Generates infrastructure-related files for services including
 * Docker configurations, environment files, and deployment manifests.
 */

import path from "node:path";
import {
  collectServiceEnvironmentVariables,
  formatDependenciesSection,
  formatEnvSection,
  formatPortsSection,
} from "@/services/generate/helpers/readme.js";
import type { ServiceGenerationTarget } from "@/services/generate/io/contexts.js";
import { getPrimaryServicePort } from "@/services/generate/util/docker/docker-generator.js";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";

/**
 * Format environment variables as YAML for Kubernetes deployment
 */
function formatEnvYaml(envBlock: Record<string, string>): string {
  if (Object.keys(envBlock).length === 0) {
    return '        # - name: SAMPLE_VAR\n        #   value: "example"';
  }
  return Object.entries(envBlock)
    .map(
      ([key, value]) =>
        `        - name: ${key}\n          value: "${String(value).replace(/"/g, '\\"')}"`,
    )
    .join("\n");
}

/**
 * Format volume mounts for Kubernetes deployment
 */
function formatVolumeMounts(volumes: any[] | undefined): string {
  if (!Array.isArray(volumes) || volumes.length === 0) return "";
  return volumes
    .map(
      (volume: any) =>
        `        - name: ${volume.name || "data"}\n          mountPath: ${volume.path || "/data"}`,
    )
    .join("\n");
}

/**
 * Format volumes for Kubernetes deployment
 */
function formatVolumes(volumes: any[] | undefined): string {
  if (!Array.isArray(volumes) || volumes.length === 0) return "";
  return volumes
    .map(
      (volume: any) =>
        `      - name: ${volume.name || "data"}\n        persistentVolumeClaim:\n          claimName: ${volume.name || "data"}-pvc`,
    )
    .join("\n");
}

/**
 * Build Kubernetes deployment YAML content
 */
function buildDeploymentYaml(
  serviceSlug: string,
  manifestImage: string,
  primaryPort: number,
  envYaml: string,
  probeBlock: string,
  volumeMounts: string,
  volumes: string,
): string {
  return [
    "apiVersion: apps/v1",
    "kind: Deployment",
    `metadata:\n  name: ${serviceSlug}`,
    "spec:",
    "  replicas: 1",
    "  selector:",
    "    matchLabels:",
    `      app: ${serviceSlug}`,
    "  template:",
    "    metadata:",
    "      labels:",
    `        app: ${serviceSlug}`,
    "    spec:",
    "      containers:",
    "        - name: app",
    `          image: ${manifestImage}`,
    "          ports:",
    `            - containerPort: ${primaryPort}`,
    "          env:",
    envYaml,
    probeBlock,
    volumeMounts ? "          volumeMounts:\n" + volumeMounts : "",
    volumes ? "      volumes:\n" + volumes : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateServiceInfrastructureArtifacts(
  serviceTarget: ServiceGenerationTarget,
  serviceSpec: any,
  options: GenerateOptions,
): Promise<string[]> {
  const outputs: string[] = [];
  const context = serviceTarget.context;
  const serviceSlug = serviceTarget.slug;
  const envBlock = collectServiceEnvironmentVariables(serviceSpec);

  // Write README
  const readmePath = path.join(context.root, "README.md");
  const readmeContent = buildServiceReadme(serviceTarget, serviceSpec, envBlock);
  await writeFileWithHooks(readmePath, ensureTrailingNewline(readmeContent), options);
  outputs.push("README.md");

  // Write deployment manifest
  const manifestDir = path.join(context.root, "manifests");
  await ensureDirectory(manifestDir, options);

  const primaryPort = getPrimaryServicePort(serviceSpec, 8080);
  const manifestImage = serviceSpec?.image ?? `ghcr.io/your-org/${serviceSlug}:latest`;
  const healthConfig = resolveHealthConfiguration(serviceSpec, primaryPort);

  const deploymentYaml = buildDeploymentYaml(
    serviceSlug,
    manifestImage,
    primaryPort,
    formatEnvYaml(envBlock),
    buildKubernetesProbeBlock(healthConfig),
    formatVolumeMounts(serviceSpec?.volumes),
    formatVolumes(serviceSpec?.volumes),
  );

  const manifestPath = path.join(manifestDir, "deployment.yaml");
  await writeFileWithHooks(manifestPath, ensureTrailingNewline(deploymentYaml), options);
  outputs.push(path.join("manifests", "deployment.yaml"));

  // Write .env.example if environment variables exist
  if (Object.keys(envBlock).length > 0) {
    const envExample = Object.entries(envBlock)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    const envPath = path.join(context.root, ".env.example");
    await writeFileWithHooks(envPath, ensureTrailingNewline(envExample), options);
    outputs.push(".env.example");
  }

  return outputs;
}

function buildServiceReadme(
  serviceTarget: ServiceGenerationTarget,
  serviceSpec: any,
  envBlock: Record<string, string>,
): string {
  const serviceSlug = serviceTarget.slug;
  const displayName = serviceTarget.key;
  const artifactType =
    serviceSpec?.type ?? serviceSpec?.artifactType ?? serviceSpec?.workload ?? "deployment";
  const ports = Array.isArray(serviceSpec?.ports) ? serviceSpec.ports : [];

  const readmeLines = [
    `# ${displayName}`,
    "",
    "This directory contains application code and infrastructure references generated by Arbiter.",
    "",
    "## Runtime Image",
    "",
    `- **Image:** ${serviceSpec?.image ?? `ghcr.io/your-org/${serviceSlug}:latest`}`,
    artifactType ? `- **Artifact Type:** ${artifactType}` : "",
    "",
    "## Ports",
    "",
    ...formatPortsSection(ports),
    "",
    "## Environment",
    "",
    ...formatEnvSection(envBlock),
    ...formatDependenciesSection(serviceSpec?.dependencies),
  ];

  return readmeLines.join("\n");
}

interface HealthConfiguration {
  path: string;
  port: number;
  interval: string;
  timeout: string;
  initialDelaySeconds: number;
}

/**
 * Resolve a string configuration value with a default fallback.
 */
function resolveStringConfig(value: unknown, defaultValue: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return defaultValue;
}

/**
 * Resolve a numeric configuration value with a default fallback.
 */
function resolveNumericConfig(value: unknown, defaultValue: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return defaultValue;
}

/**
 * Normalize a path to ensure it starts with a forward slash.
 */
function normalizePath(rawPath: string): string {
  return rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
}

function resolveHealthConfiguration(
  serviceSpec: any,
  defaultPort: number,
): HealthConfiguration | null {
  const config = serviceSpec?.healthCheck;
  const rawPath = resolveStringConfig(config?.path, "/healthz");

  return {
    path: normalizePath(rawPath),
    port: resolveNumericConfig(config?.port, defaultPort),
    interval: resolveStringConfig(config?.interval, "30s"),
    timeout: resolveStringConfig(config?.timeout, "10s"),
    initialDelaySeconds: resolveNumericConfig(config?.initialDelaySeconds, 5),
  };
}

function durationToSeconds(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d+)(ms|s|m)$/i);
    if (match) {
      const amount = Number.parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      switch (unit) {
        case "ms":
          return Math.max(1, Math.round(amount / 1000));
        case "s":
          return amount;
        case "m":
          return amount * 60;
      }
    }
  }

  return fallback;
}

function buildKubernetesProbeBlock(config: HealthConfiguration | null): string {
  if (!config) {
    return "";
  }

  const periodSeconds = durationToSeconds(config.interval, 30);
  const timeoutSeconds = durationToSeconds(config.timeout, 10);
  const readinessDelay = Math.max(2, Math.floor(config.initialDelaySeconds / 2));

  const readinessProbe = `
          readinessProbe:
            httpGet:
              path: ${config.path}
              port: ${config.port}
            initialDelaySeconds: ${readinessDelay}
            periodSeconds: ${periodSeconds}
            timeoutSeconds: ${timeoutSeconds}`.trimStart();

  const livenessProbe = `
          livenessProbe:
            httpGet:
              path: ${config.path}
              port: ${config.port}
            initialDelaySeconds: ${config.initialDelaySeconds}
            periodSeconds: ${periodSeconds}
            timeoutSeconds: ${timeoutSeconds}`.trimStart();

  return readinessProbe + "\n" + livenessProbe;
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}
