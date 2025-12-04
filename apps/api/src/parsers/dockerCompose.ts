import YAML from "js-yaml";
import type { FileParser } from "./base";
import { makeArtifactId } from "./helpers";

export const dockerComposeParser: FileParser = {
  name: "docker-compose",
  priority: 9,
  matches: (filePath) => {
    const base = filePath.split("/").pop()?.toLowerCase() ?? "";
    return base === "docker-compose.yml" || base === "docker-compose.yaml";
  },
  parse: (content, context) => {
    let parsedYaml: any;
    try {
      parsedYaml = YAML.load(content);
    } catch {
      return;
    }

    const artifact = context.artifact;
    if (!artifact) return;

    if (typeof parsedYaml !== "object" || parsedYaml === null) return;

    const servicesSection = parsedYaml.services;
    if (!servicesSection || typeof servicesSection !== "object") return;

    const serviceKeys = Object.keys(servicesSection);
    const composeServices: Array<Record<string, unknown>> = [];
    const composeServicesDetailed: Array<Record<string, unknown>> = [];

    for (const serviceName of serviceKeys) {
      const service = servicesSection[serviceName];
      if (!service || typeof service !== "object") continue;

      let serviceYaml: string | undefined;
      try {
        serviceYaml = YAML.dump({ [serviceName]: service }, { indent: 2 })?.trim();
      } catch {
        serviceYaml = undefined;
      }

      const serviceArtifact = {
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
        links: [
          {
            type: "defined_in",
            target: context.filePath,
          },
        ],
      };

      context.addArtifact(serviceArtifact);
      composeServices.push({
        service: serviceName,
        image: service.image,
        ports: service.ports,
        composeServiceYaml: serviceYaml,
        composeService: service,
      });

      composeServicesDetailed.push({
        service: serviceName,
        yaml: serviceYaml,
        config: service,
      });
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
