/**
 * @packageDocumentation
 * Terraform artifact generation for infrastructure deployment.
 *
 * Provides functionality to:
 * - Generate Terraform modules for services
 * - Create deployment configurations for Kubernetes
 * - Parse deployment service configurations
 * - Support various workload types (deployment, statefulset, job)
 */

import path from "node:path";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import { joinRelativePath, toPathSegments } from "@/services/generate/util/shared.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { ProjectStructureConfig } from "@/types.js";
import {
  resolveServiceArtifactType,
  resolveServiceWorkload,
} from "@/utils/api/service-metadata.js";
import type { DeploymentConfig, ServiceArtifactType, ServiceWorkload } from "@arbiter/shared";

export interface TerraformServiceMetadata {
  name: string;
  language: string;
  artifactType: ServiceArtifactType;
  type: ServiceWorkload;
  workload: ServiceWorkload;
  image?: string;
  sourceDirectory?: string;
  buildContext?: {
    dockerfile?: string;
    target?: string;
    buildArgs?: Record<string, string>;
  };
  ports?: Array<{ name: string; port: number; targetPort?: number; protocol?: string }>;
  env?: Record<string, string>;
  volumes?: Array<{
    name: string;
    path: string;
    size?: string;
    type?: "persistentVolumeClaim" | "configMap" | "secret";
  }>;
  config?: {
    files?: Array<{ name: string; content: string | Record<string, any> }>;
    [key: string]: any;
  };
  replicas?: number;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  healthCheck?: {
    path?: string;
    port?: number;
    initialDelay?: number;
    periodSeconds?: number;
  };
}

export interface TerraformClusterConfig {
  name: string;
  provider: "kubernetes" | "eks" | "gke" | "aks";
  context?: string;
  namespace: string;
  config: Record<string, any>;
}

export async function generateTerraformArtifacts(
  config: { name: string },
  outputDir: string,
  assemblyConfig: any,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  const files: string[] = [];
  const infraDirSegments = toPathSegments(structure.infraDirectory);
  const effectiveInfraSegments = infraDirSegments.length > 0 ? infraDirSegments : ["terraform"];
  const infraDirRelative = joinRelativePath(...effectiveInfraSegments);
  await ensureDirectory(path.join(outputDir, ...effectiveInfraSegments), options);

  const { services, cluster } = parseDeploymentServices(assemblyConfig);

  const mainTf = generateTerraformMain(cluster, config.name);
  const mainPath = path.join(outputDir, ...effectiveInfraSegments, "main.tf");
  await writeFileWithHooks(mainPath, mainTf, options);
  files.push(joinRelativePath(infraDirRelative, "main.tf"));

  const variablesTf = generateTerraformVariables(services, cluster);
  const variablesPath = path.join(outputDir, ...effectiveInfraSegments, "variables.tf");
  await writeFileWithHooks(variablesPath, variablesTf, options);
  files.push(joinRelativePath(infraDirRelative, "variables.tf"));

  const servicesTf = generateTerraformServices(services, config.name);
  const servicesPath = path.join(outputDir, ...effectiveInfraSegments, "services.tf");
  await writeFileWithHooks(servicesPath, servicesTf, options);
  files.push(joinRelativePath(infraDirRelative, "services.tf"));

  const outputsTf = generateTerraformOutputs(services, config.name);
  const outputsPath = path.join(outputDir, ...effectiveInfraSegments, "outputs.tf");
  await writeFileWithHooks(outputsPath, outputsTf, options);
  files.push(joinRelativePath(infraDirRelative, "outputs.tf"));

  const readme = generateTerraformReadme(services, cluster, config.name);
  const readmePath = path.join(outputDir, ...effectiveInfraSegments, "README.md");
  await writeFileWithHooks(readmePath, readme, options);
  files.push(joinRelativePath(infraDirRelative, "README.md"));

  return files;
}

/**
 * Find the best matching deployment config
 */
function findDeploymentConfig(
  deployments: Record<string, DeploymentConfig>,
): DeploymentConfig | undefined {
  const entries = Object.entries(deployments);
  const match =
    entries.find(([, cfg]) => cfg?.target === "kubernetes") ||
    entries.find(([, cfg]) => cfg?.target === "both") ||
    entries[0];
  return match?.[1];
}

/**
 * Extract cluster configuration from deployment
 */
function extractClusterConfig(
  deploymentConfig: DeploymentConfig | undefined,
): TerraformClusterConfig | null {
  if (!deploymentConfig?.cluster) {
    return null;
  }

  return {
    name: deploymentConfig.cluster.name || "default",
    provider: deploymentConfig.cluster.provider || "kubernetes",
    context: deploymentConfig.cluster.context,
    namespace: deploymentConfig.cluster.namespace || "default",
    config: deploymentConfig.cluster.config || {},
  };
}

/**
 * Parse services from CUE data (supports both legacy services and new packages)
 */
function parseServicesFromCueData(cueData: any): TerraformServiceMetadata[] {
  const services: TerraformServiceMetadata[] = [];

  if (!cueData?.packages) {
    return services;
  }

  for (const [packageName, packageConfig] of Object.entries(cueData.packages)) {
    const service = parseDeploymentServiceConfig(packageName, packageConfig as any);
    if (service) {
      services.push(service);
    }
  }

  return services;
}

function parseDeploymentServices(assemblyConfig: any): {
  services: TerraformServiceMetadata[];
  cluster: TerraformClusterConfig | null;
} {
  const cueData = assemblyConfig._fullCueData || assemblyConfig;
  const deployments = cueData?.environments ?? cueData?.deployments;

  let cluster: TerraformClusterConfig | null = null;
  if (deployments && typeof deployments === "object") {
    const deploymentConfig = findDeploymentConfig(deployments as Record<string, DeploymentConfig>);
    cluster = extractClusterConfig(deploymentConfig);
  }

  const services = parseServicesFromCueData(cueData);

  return { services, cluster };
}

/**
 * Resolve the workload type from service config
 */
function resolveWorkloadType(config: any): ServiceWorkload {
  const fromResolver = resolveServiceWorkload(config) as ServiceWorkload | undefined;
  if (fromResolver) return fromResolver;

  if (typeof config.workload === "string") {
    return config.workload as ServiceWorkload;
  }

  return "deployment";
}

/**
 * Normalize volume configurations with default type
 */
function normalizeVolumes(volumes: any[] | undefined): TerraformServiceMetadata["volumes"] {
  if (!volumes) return undefined;

  return volumes.map((vol: any) => ({
    ...vol,
    type: vol.type || "persistentVolumeClaim",
  }));
}

/**
 * Apply optional service properties from config
 */
function applyOptionalServiceProps(service: TerraformServiceMetadata, config: any): void {
  const directProps = [
    "image",
    "sourceDirectory",
    "buildContext",
    "ports",
    "env",
    "resources",
    "labels",
    "annotations",
    "config",
    "healthCheck",
  ] as const;

  for (const prop of directProps) {
    if (config[prop] !== undefined) {
      (service as any)[prop] = config[prop];
    }
  }

  // Volumes need special handling for default type
  const normalizedVolumes = normalizeVolumes(config.volumes);
  if (normalizedVolumes) {
    service.volumes = normalizedVolumes;
  }
}

export function parseDeploymentServiceConfig(
  name: string,
  config: any,
): TerraformServiceMetadata | null {
  const artifactType = resolveServiceArtifactType(config);
  const workload = resolveWorkloadType(config);

  const service: TerraformServiceMetadata = {
    name,
    language: config.language || "container",
    artifactType,
    type: workload,
    workload,
    replicas: config.replicas || 1,
  };

  applyOptionalServiceProps(service, config);

  return service;
}

function generateTerraformMain(
  cluster: TerraformClusterConfig | null,
  projectName: string,
): string {
  const clusterName = cluster?.name || "default";
  const namespace = cluster?.namespace || projectName.toLowerCase();

  return `terraform {
  required_version = ">= 1.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

provider "kubernetes" {
  # Configuration will be loaded from kubeconfig by default
  # Override these values via terraform.tfvars if needed
  config_path    = var.kubeconfig_path
  config_context = var.cluster_context
}

# Create namespace if it doesn't exist
resource "kubernetes_namespace" "${namespace.replace(/-/g, "_")}" {
  metadata {
    name = "${namespace}"
    labels = {
      name    = "${namespace}"
      project = "${projectName.toLowerCase()}"
    }
  }
}
`;
}

function generateTerraformVariables(
  services: TerraformServiceMetadata[],
  cluster: TerraformClusterConfig | null,
): string {
  const clusterName = cluster?.name || "default";

  return `variable "kubeconfig_path" {
  description = "Path to the kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "cluster_context" {
  description = "Kubernetes cluster context to use"
  type        = string
  default     = "${cluster?.context || clusterName}"
}

variable "namespace" {
  description = "Kubernetes namespace for deployment"
  type        = string
  default     = "${cluster?.namespace || "default"}"
}

variable "image_tag" {
  description = "Docker image tag for services"
  type        = string
  default     = "latest"
}

${services
  .map((service) => {
    const serviceName = service.name.replace(/-/g, "_");
    return `variable "${serviceName}_replicas" {
  description = "Number of replicas for ${service.name}"
  type        = number
  default     = ${service.replicas || 1}
}`;
  })
  .join("\n\n")}
`;
}

function generateTerraformServices(
  services: TerraformServiceMetadata[],
  projectName: string,
): string {
  return services.map((service) => generateTerraformService(service, projectName)).join("\n\n");
}

/**
 * Context for Terraform HCL generation.
 */
interface TerraformContext {
  serviceName: string;
  namespace: string;
  namespaceResource: string;
  projectName: string;
}

/**
 * Generates complete Terraform configuration for a service.
 */
function generateTerraformService(service: TerraformServiceMetadata, projectName: string): string {
  const ctx: TerraformContext = {
    serviceName: service.name.replace(/-/g, "_"),
    namespace: projectName.toLowerCase(),
    namespaceResource: projectName.toLowerCase().replace(/-/g, "_"),
    projectName,
  };

  const sections = [
    generateWorkloadResource(service, ctx),
    generateServiceResource(service, ctx),
    generatePVCResources(service, ctx),
  ];

  return sections.filter(Boolean).join("\n\n");
}

/**
 * Generates the main workload resource (deployment, statefulset, etc.).
 */
function generateWorkloadResource(
  service: TerraformServiceMetadata,
  ctx: TerraformContext,
): string {
  const terraformWorkloadType = getTerraformWorkloadType(service.type);
  const metadata = generateWorkloadMetadata(service, ctx);
  const spec = generateWorkloadSpec(service, ctx);

  return `# ${service.name} ${service.type}
resource "kubernetes_${terraformWorkloadType}" "${ctx.serviceName}" {
${metadata}
${spec}
}`;
}

/**
 * Generates metadata block for workload.
 */
function generateWorkloadMetadata(
  service: TerraformServiceMetadata,
  ctx: TerraformContext,
): string {
  const labelsContent = generateLabelsContent(service, ctx.projectName);
  const annotationsBlock = generateAnnotationsBlock(service);

  return `  metadata {
    name      = "${service.name}"
    namespace = kubernetes_namespace.${ctx.namespaceResource}.metadata[0].name
    labels = {
${labelsContent}
    }${annotationsBlock}
  }`;
}

/**
 * Generates labels content for metadata.
 */
function generateLabelsContent(service: TerraformServiceMetadata, projectName: string): string {
  const baseLabels = [
    `      app     = "${service.name}"`,
    `      project = "${projectName.toLowerCase()}"`,
  ];

  if (service.labels) {
    const customLabels = Object.entries(service.labels).map(([k, v]) => `      ${k} = "${v}"`);
    return [...baseLabels, ...customLabels].join("\n");
  }

  return baseLabels.join("\n");
}

/**
 * Generates annotations block if annotations exist.
 */
function generateAnnotationsBlock(service: TerraformServiceMetadata): string {
  if (!service.annotations) return "";

  const entries = Object.entries(service.annotations)
    .map(([k, v]) => `      "${k}" = "${v}"`)
    .join("\n");

  return `
    annotations = {
${entries}
    }`;
}

/**
 * Generates spec block for workload.
 */
function generateWorkloadSpec(service: TerraformServiceMetadata, ctx: TerraformContext): string {
  const statefulSetServiceName =
    service.type === "statefulset"
      ? `\n    service_name = kubernetes_service.${ctx.serviceName}.metadata[0].name`
      : "";

  const template = generateTemplateSpec(service, ctx);

  return `  spec {${statefulSetServiceName}
    replicas = var.${ctx.serviceName}_replicas

    selector {
      match_labels = {
        app = "${service.name}"
      }
    }

${template}
  }`;
}

/**
 * Generates template spec containing pod definition.
 */
function generateTemplateSpec(service: TerraformServiceMetadata, ctx: TerraformContext): string {
  const containerSpec = generateContainerSpec(service, ctx);
  const volumeSpecs = generateVolumeSpecs(service, ctx);

  return `    template {
      metadata {
        labels = {
          app     = "${service.name}"
          project = "${ctx.projectName.toLowerCase()}"
        }
      }

      spec {
${containerSpec}${volumeSpecs}
      }
    }`;
}

/**
 * Generates container specification.
 */
function generateContainerSpec(service: TerraformServiceMetadata, ctx: TerraformContext): string {
  const ports = generateContainerPorts(service);
  const envVars = generateEnvVars(service);
  const resources = generateResourcesBlock(service);
  const volumeMounts = generateVolumeMounts(service);

  return `        container {
          name  = "${service.name}"
          image = "${service.image || `${service.name}:\${var.image_tag}`}"${ports}${envVars}${resources}${volumeMounts}
        }`;
}

/**
 * Generates container port definitions.
 */
function generateContainerPorts(service: TerraformServiceMetadata): string {
  if (!service.ports?.length) return "";

  return service.ports
    .map(
      (port) => `
          port {
            name           = "${port.name}"
            container_port = ${port.targetPort || port.port}
            protocol       = "${port.protocol || "TCP"}"
          }`,
    )
    .join("");
}

/**
 * Generates environment variable definitions.
 */
function generateEnvVars(service: TerraformServiceMetadata): string {
  if (!service.env || Object.keys(service.env).length === 0) return "";

  return Object.entries(service.env)
    .map(
      ([key, value]) => `
          env {
            name  = "${key}"
            value = "${value}"
          }`,
    )
    .join("");
}

/**
 * Generates resources block (requests and limits).
 */
function generateResourcesBlock(service: TerraformServiceMetadata): string {
  if (!service.resources) return "";

  const requests = generateResourceConstraints(service.resources.requests, "requests");
  const limits = generateResourceConstraints(service.resources.limits, "limits");

  return `
          resources {${requests}${limits}
          }`;
}

/**
 * Generates resource constraints (requests or limits).
 */
function generateResourceConstraints(
  constraints: { cpu?: string; memory?: string } | undefined,
  type: "requests" | "limits",
): string {
  if (!constraints) return "";

  const entries: string[] = [];
  if (constraints.cpu) entries.push(`              cpu    = "${constraints.cpu}"`);
  if (constraints.memory) entries.push(`              memory = "${constraints.memory}"`);

  if (entries.length === 0) return "";

  return `
            ${type} = {
${entries.join("\n")}
            }`;
}

/**
 * Generates volume mount definitions.
 */
function generateVolumeMounts(service: TerraformServiceMetadata): string {
  if (!service.volumes?.length) return "";

  return service.volumes
    .map(
      (volume) => `
          volume_mount {
            name       = "${volume.name}"
            mount_path = "${volume.path}"
          }`,
    )
    .join("");
}

/**
 * Generates volume specifications for pod spec.
 */
function generateVolumeSpecs(service: TerraformServiceMetadata, ctx: TerraformContext): string {
  if (!service.volumes?.length) return "";

  const volumes = service.volumes
    .map(
      (volume) => `
        volume {
          name = "${volume.name}"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.${ctx.serviceName}_${volume.name.replace(/-/g, "_")}.metadata[0].name
          }
        }`,
    )
    .join("");

  return volumes;
}

/**
 * Generates Kubernetes Service resource if ports are defined.
 */
function generateServiceResource(service: TerraformServiceMetadata, ctx: TerraformContext): string {
  if (!service.ports?.length) return "";

  const portBlocks = service.ports
    .map(
      (port) => `    port {
      name        = "${port.name}"
      port        = ${port.port}
      target_port = ${port.targetPort || port.port}
      protocol    = "${port.protocol || "TCP"}"
    }`,
    )
    .join("\n");

  return `resource "kubernetes_service" "${ctx.serviceName}" {
  metadata {
    name      = "${service.name}"
    namespace = kubernetes_namespace.${ctx.namespaceResource}.metadata[0].name
    labels = {
      app     = "${service.name}"
      project = "${ctx.projectName.toLowerCase()}"
    }
  }

  spec {
    selector = {
      app = "${service.name}"
    }

${portBlocks}
  }
}`;
}

/**
 * Generates PersistentVolumeClaim resources for volumes.
 */
function generatePVCResources(service: TerraformServiceMetadata, ctx: TerraformContext): string {
  if (!service.volumes?.length) return "";

  return service.volumes
    .map(
      (
        volume,
      ) => `resource "kubernetes_persistent_volume_claim" "${ctx.serviceName}_${volume.name.replace(/-/g, "_")}" {
  metadata {
    name      = "${service.name}-${volume.name}"
    namespace = kubernetes_namespace.${ctx.namespaceResource}.metadata[0].name
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "${volume.size || "10Gi"}"
      }
    }
  }
}`,
    )
    .join("\n\n");
}

function generateTerraformOutputs(
  services: TerraformServiceMetadata[],
  projectName: string,
): string {
  const outputs = services
    .filter((service) => service.ports && service.ports.length > 0)
    .map((service) => {
      const serviceName = service.name.replace(/-/g, "_");
      return `output "${serviceName}_service_ip" {
  description = "Cluster IP of the ${service.name} service"
  value       = kubernetes_service.${serviceName}.spec[0].cluster_ip
}

output "${serviceName}_ports" {
  description = "Ports exposed by ${service.name} service"
  value       = [${service.ports?.map((p) => `"${p.port}"`).join(", ")}]
}`;
    });

  return `output "namespace" {
  description = "Kubernetes namespace"
  value       = kubernetes_namespace.${projectName.toLowerCase().replace(/-/g, "_")}.metadata[0].name
}

${outputs.join("\n\n")}
`;
}

/**
 * Format a single service's documentation section
 */
function formatServiceSection(service: TerraformServiceMetadata): string {
  const portsLine = service.ports
    ? `\n- **Ports**: ${service.ports.map((p) => `${p.port}/${p.protocol || "TCP"} (${p.name})`).join(", ")}`
    : "";

  const storageLine = service.volumes
    ? `\n- **Storage**: ${service.volumes.map((v) => `${v.name} → ${v.path} (${v.size || "10Gi"})`).join(", ")}`
    : "";

  return `### ${service.name}
- **Language**: ${service.language}
- **Type**: ${service.type}
- **Image**: ${service.image || `${service.name}:latest`}${portsLine}
- **Replicas**: ${service.replicas || 1}${storageLine}`;
}

/**
 * Format port-forward access instructions for a service
 */
function formatServiceAccessSection(service: TerraformServiceMetadata, namespace: string): string {
  const port = service.ports?.[0]?.port;
  if (!port) return "";

  return `### ${service.name}
\`\`\`bash
kubectl port-forward -n ${namespace} service/${service.name} ${port}:${port}
\`\`\`
Access at: http://localhost:${port}
`;
}

/**
 * Format service replicas for tfvars
 */
function formatServiceReplicas(service: TerraformServiceMetadata): string {
  return `${service.name.replace(/-/g, "_")}_replicas = ${service.replicas || 1}`;
}

function generateTerraformReadme(
  services: TerraformServiceMetadata[],
  cluster: TerraformClusterConfig | null,
  projectName: string,
): string {
  const clusterName = cluster?.name || "default";
  const namespace = cluster?.namespace || projectName.toLowerCase();
  const context = cluster?.context || clusterName;

  const servicesSections = services.map(formatServiceSection).join("\n\n");
  const replicasVars = services.map(formatServiceReplicas).join("\n");
  const accessSections = services
    .filter((s) => s.ports && s.ports.length > 0)
    .map((s) => formatServiceAccessSection(s, namespace))
    .join("\n");

  return `# ${projectName} - Terraform Kubernetes Deployment

This directory contains Terraform configurations for deploying ${projectName} to Kubernetes.

## Prerequisites

- [Terraform](https://terraform.io) >= 1.0
- [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/) configured with cluster access
- Kubernetes cluster accessible via kubeconfig

## Configuration

### Cluster Configuration
- **Cluster**: ${clusterName}
- **Namespace**: ${namespace}
- **Context**: ${context}

## Services

${servicesSections}

## Deployment

### 1. Initialize Terraform
\`\`\`bash
terraform init
\`\`\`

### 2. Review the Plan
\`\`\`bash
terraform plan
\`\`\`

### 3. Apply Configuration
\`\`\`bash
terraform apply
\`\`\`

### 4. Verify Deployment
\`\`\`bash
kubectl get all -n ${namespace}
\`\`\`

## Customization

Create a \`terraform.tfvars\` file to customize deployment:

\`\`\`hcl
# Cluster configuration
kubeconfig_path = "~/.kube/config"
cluster_context = "${context}"
namespace       = "${namespace}"

# Image configuration
image_tag = "v1.0.0"

# Service scaling
${replicasVars}
\`\`\`

## Access Services

${accessSections}

## State Management

This configuration uses local state. For production deployments, configure remote state:

\`\`\`hcl
terraform {
  backend "s3" {
    bucket = "your-terraform-state"
    key    = "${projectName}/terraform.tfstate"
    region = "us-west-2"
  }
}
\`\`\`

## Cleanup

\`\`\`bash
terraform destroy
\`\`\`

## Troubleshooting

### Check pod status
\`\`\`bash
kubectl get pods -n ${namespace}
kubectl describe pod <pod-name> -n ${namespace}
\`\`\`

### View logs
\`\`\`bash
kubectl logs -f <pod-name> -n ${namespace}
\`\`\`

### Apply changes
After modifying Terraform files:
\`\`\`bash
terraform plan
terraform apply
\`\`\`
`;
}

function getTerraformWorkloadType(type: string): string {
  switch (type) {
    case "statefulset":
      return "stateful_set";
    case "daemonset":
      return "daemon_set";
    case "job":
      return "job";
    case "cronjob":
      return "cron_job";
    default:
      return "deployment";
  }
}
