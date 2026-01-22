/**
 * @packageDocumentation
 * Compose service section generators.
 *
 * Provides utilities for generating Docker Compose service configurations
 * including health checks, port publishing, and deployment settings.
 */

import {
  resolveServiceArtifactType,
  resolveServiceWorkload,
} from "@/utils/api/service-metadata.js";
import type { ServiceConfig } from "@arbiter/shared";

/** Base configuration type for deployment services */
type DeploymentServiceConfigBase = Partial<ServiceConfig>;

export type ComposeServiceConfig = DeploymentServiceConfigBase & {
  /** Artifact type for deployment classification */
  artifactType?: "internal" | "external";
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

export const CLIENT_COMPONENT_LABEL = "arbiter.io/component";

export function shouldPublishPorts(service: ComposeServiceConfig): boolean {
  const workload = service.workload || resolveServiceWorkload(service) || "deployment";
  return !(workload === "statefulset" && resolveServiceArtifactType(service) === "external");
}

type HealthConfig = { path: string; interval: string; timeout: string };

const CLIENT_HEALTH_CONFIG: HealthConfig = { path: "/", interval: "30s", timeout: "5s" };

function extractProbeHealthConfig(probe: any): HealthConfig | null {
  if (!probe?.httpGet?.path) return null;
  return {
    path: probe.httpGet.path,
    interval: probe.periodSeconds ? `${probe.periodSeconds}s` : "30s",
    timeout: probe.timeoutSeconds ? `${probe.timeoutSeconds}s` : "5s",
  };
}

export function resolveHealthConfiguration(
  service: ComposeServiceConfig,
  _port: number,
): HealthConfig {
  const isClientComponent =
    service.labels?.[CLIENT_COMPONENT_LABEL] === "client" ||
    service.name.toLowerCase().includes("client");
  if (isClientComponent) {
    return CLIENT_HEALTH_CONFIG;
  }

  const probe = service.readinessProbe || service.livenessProbe || service.startupProbe;
  const probeConfig = extractProbeHealthConfig(probe);
  if (probeConfig) return probeConfig;

  return {
    path: service.healthCheck?.path || "healthz",
    interval: service.healthCheck?.interval || "30s",
    timeout: service.healthCheck?.timeout || "5s",
  };
}

export function buildHostPortVariable(serviceName: string, portName?: string): string {
  const normalizedService = serviceName.replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
  const normalizedPort =
    portName && portName !== "http"
      ? `_${portName.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`
      : "";
  return `${normalizedService}${normalizedPort}_PORT`;
}

export function generateBuildSection(service: ComposeServiceConfig): string {
  if (!service.resolvedBuildContext) return "";

  let section = `
    build:
      context: ${service.resolvedBuildContext}`;

  if (service.buildContext?.dockerfile) {
    section += `
      dockerfile: ${service.buildContext.dockerfile}`;
  }
  if (service.buildContext?.target) {
    section += `
      target: ${service.buildContext.target}`;
  }
  if (service.buildContext?.buildArgs) {
    section += `
      args:
${Object.entries(service.buildContext.buildArgs)
  .map(([k, v]) => `        ${k}: ${v}`)
  .join("\n")}`;
  }
  return section;
}

export function generateImageSection(service: ComposeServiceConfig): string {
  const serviceName = service.name;
  if (resolveServiceArtifactType(service) === "internal") {
    return service.resolvedBuildContext
      ? generateBuildSection(service)
      : `
    image: ${service.image || `${serviceName}:latest`}`;
  }
  return `
    image: ${service.image}`;
}

export function generatePortsSection(service: ComposeServiceConfig): string {
  if (!shouldPublishPorts(service) || !service.ports?.length) return "";
  return `
    ports:
${service.ports
  .map((p) => {
    const hostVar = buildHostPortVariable(service.name, p.name);
    return `      - "\${${hostVar}:-${p.port}}:${p.targetPort || p.port}"`;
  })
  .join("\n")}`;
}

export function generateEnvSection(service: ComposeServiceConfig): string {
  if (!service.env || Object.keys(service.env).length === 0) return "";
  return `
    environment:
${Object.entries(service.env)
  .map(([k, v]) => `      ${k}: ${v}`)
  .join("\n")}`;
}

export function generateDependsOnSection(service: ComposeServiceConfig): string {
  if (!service.dependencies?.length) return "";
  return `
    depends_on:
${service.dependencies.map((dep) => `      - ${dep}`).join("\n")}`;
}

export function generateVolumeMountLine(
  service: ComposeServiceConfig,
  volume: ComposeServiceConfig["volumes"][0],
): string {
  const serviceName = service.name;
  if (volume.type === "persistentVolumeClaim") {
    return `
      - ${serviceName}_${volume.name}:${volume.path}`;
  }
  if (volume.type === "configMap" && service.config?.files) {
    const configFile = service.config.files.find((f) => f.name === volume.name);
    if (configFile) {
      return `
      - ./config/${serviceName}/${configFile.name}:${volume.path}:ro`;
    }
  }
  return `
      - ${volume.name}:${volume.path}`;
}

export function generateVolumesSection(service: ComposeServiceConfig): string {
  if (!service.volumes?.length) return "";
  return `
    volumes:${service.volumes.map((v) => generateVolumeMountLine(service, v)).join("")}`;
}

export function generateLabelsSection(service: ComposeServiceConfig, projectName: string): string {
  const labels = {
    project: projectName,
    service: service.name,
    "service-type": resolveServiceArtifactType(service),
    ...service.labels,
  };
  return `
    labels:
${Object.entries(labels)
  .map(([k, v]) => `      ${k}: "${v}"`)
  .join("\n")}`;
}

export function generateHealthcheckSection(service: ComposeServiceConfig): string {
  if (!service.ports?.length) return "";
  const httpPort = service.ports.find((p) => p.name === "http" || p.name === "web");
  if (!httpPort) return "";

  const resolvedPort = httpPort.targetPort || httpPort.port;
  const healthConfig = resolveHealthConfiguration(service, resolvedPort);
  const healthPath = healthConfig.path.startsWith("/")
    ? healthConfig.path
    : `/${healthConfig.path}`;
  return `
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${resolvedPort}${healthPath}"]
      interval: ${healthConfig.interval}
      timeout: ${healthConfig.timeout}
      retries: 3`;
}

export function generateResourceLimitsSection(service: ComposeServiceConfig): string {
  if (!service.resources?.limits) return "";
  let section = "";
  const limits = service.resources.limits;

  if (limits.memory) {
    section += `
    mem_limit: ${limits.memory.replace("Mi", "m").replace("Gi", "g")}`;
  }
  if (limits.cpu) {
    const cpuLimit = limits.cpu.replace("m", "");
    const cpuFloat = (Number.parseInt(cpuLimit) / 1000).toFixed(2);
    section += `
    cpus: "${cpuFloat}"`;
  }
  return section;
}

export function generateComposeService(service: ComposeServiceConfig, projectName: string): string {
  const serviceName = service.name;
  return `  ${serviceName}:${generateImageSection(service)}
    container_name: ${projectName}_${serviceName}
    restart: unless-stopped${generatePortsSection(service)}${generateEnvSection(service)}${generateDependsOnSection(service)}${generateVolumesSection(service)}${generateLabelsSection(service, projectName)}${generateHealthcheckSection(service)}${generateResourceLimitsSection(service)}`;
}
