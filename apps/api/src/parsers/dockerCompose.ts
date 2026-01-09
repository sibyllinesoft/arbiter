/**
 * Docker Compose file parser for extracting service definitions.
 * Parses docker-compose.yml/yaml files and creates artifacts for each service.
 */
import YAML from "js-yaml";
import type { FileParser } from "./base";
import { makeArtifactId } from "./helpers";

const COMPOSE_FILE_NAMES = ["docker-compose.yml", "docker-compose.yaml"] as const;

/** Check if a file path is a docker-compose file */
function isComposeFile(filePath: string): boolean {
  const base = filePath.split("/").pop()?.toLowerCase() ?? "";
  return COMPOSE_FILE_NAMES.includes(base as (typeof COMPOSE_FILE_NAMES)[number]);
}

/** Safely parse YAML content, returning null on error */
function parseYamlSafe(content: string): Record<string, unknown> | null {
  try {
    const parsed = YAML.load(content);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Safely dump a service to YAML string */
function dumpServiceYaml(serviceName: string, service: unknown): string | undefined {
  try {
    return YAML.dump({ [serviceName]: service }, { indent: 2 })?.trim();
  } catch {
    return undefined;
  }
}

/** Build a service artifact from compose service definition */
function buildServiceArtifact(
  serviceName: string,
  service: Record<string, unknown>,
  serviceYaml: string | undefined,
  context: { projectId: string; filePath: string },
) {
  return {
    id: makeArtifactId(context.projectId, `${context.filePath}#${serviceName}`),
    name: serviceName,
    type: "service" as const,
    description: `Service defined in docker-compose file ${context.filePath}`,
    language: null,
    framework: null,
    metadata: {
      composeFile: context.filePath,
      service: serviceName,
      image: service.image,
      ports: service.ports,
      environment: service.environment,
      build: service.build,
      dependsOn: service.depends_on ?? service.dependsOn,
      composeService: service,
      composeServiceYaml: serviceYaml,
    },
    filePath: context.filePath,
    links: [{ type: "defined_in", target: context.filePath }],
  };
}

/** Build simplified service info for metadata */
function buildServiceInfo(
  serviceName: string,
  service: Record<string, unknown>,
  serviceYaml: string | undefined,
) {
  return {
    service: serviceName,
    image: service.image,
    ports: service.ports,
    composeServiceYaml: serviceYaml,
    composeService: service,
  };
}

/** Build detailed service info for metadata */
function buildDetailedServiceInfo(
  serviceName: string,
  service: Record<string, unknown>,
  serviceYaml: string | undefined,
) {
  return {
    service: serviceName,
    yaml: serviceYaml,
    config: service,
  };
}

/**
 * Parser for docker-compose.yml and docker-compose.yaml files.
 * Extracts service definitions and creates individual artifacts for each service.
 */
export const dockerComposeParser: FileParser = {
  name: "docker-compose",
  priority: 9,
  matches: isComposeFile,
  parse: (content, context) => {
    const parsedYaml = parseYamlSafe(content);
    if (!parsedYaml) return;

    const artifact = context.artifact;
    if (!artifact) return;

    const servicesSection = parsedYaml.services;
    if (!servicesSection || typeof servicesSection !== "object") return;

    const serviceKeys = Object.keys(servicesSection as object);
    const composeServices: Array<Record<string, unknown>> = [];
    const composeServicesDetailed: Array<Record<string, unknown>> = [];

    for (const serviceName of serviceKeys) {
      const service = (servicesSection as Record<string, unknown>)[serviceName];
      if (!service || typeof service !== "object") continue;

      const serviceRecord = service as Record<string, unknown>;
      const serviceYaml = dumpServiceYaml(serviceName, service);
      const serviceArtifact = buildServiceArtifact(
        serviceName,
        serviceRecord,
        serviceYaml,
        context,
      );

      context.addArtifact(serviceArtifact);
      composeServices.push(buildServiceInfo(serviceName, serviceRecord, serviceYaml));
      composeServicesDetailed.push(
        buildDetailedServiceInfo(serviceName, serviceRecord, serviceYaml),
      );
    }

    artifact.metadata = {
      ...artifact.metadata,
      services: composeServices,
      composeServicesDetailed,
      composeYaml:
        typeof content === "string" ? content.trim() : YAML.dump(parsedYaml, { indent: 2 }),
    };
  },
};
