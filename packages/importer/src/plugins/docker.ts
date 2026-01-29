import * as path from "path";
import * as fs from "fs-extra";
import * as yaml from "yaml";
import type {
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
} from "../types";

export interface DockerData extends Record<string, unknown> {
  name: string;
  description: string;
  configType: string;
  filePath: string;
  image?: string;
  ports?: Array<{ port: number; targetPort?: number; protocol?: string }>;
  environment?: Record<string, string>;
  volumes?: string[];
  dockerfile?: string;
  buildContext?: string;
}

/**
 * Simplified Docker plugin for Resource Detection.
 *
 * Parses Dockerfiles and docker-compose files.
 * Outputs Resource artifacts with kind "container".
 * Does NOT try to match to code packages - that's done via relationships.
 */
export class DockerPlugin implements ImporterPlugin {
  name(): string {
    return "docker";
  }

  supports(filePath: string): boolean {
    const basename = path.basename(filePath).toLowerCase();
    return (
      basename === "dockerfile" ||
      basename === "docker-compose.yml" ||
      basename === "docker-compose.yaml" ||
      basename.startsWith("compose.")
    );
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const basename = path.basename(filePath).toLowerCase();
    const projectRoot = context?.projectRoot || process.cwd();

    try {
      if (basename === "dockerfile") {
        return this.parseDockerfile(fileContent, filePath, projectRoot);
      }

      if (basename.includes("compose")) {
        return this.parseComposeFile(fileContent, filePath, projectRoot);
      }

      return [];
    } catch {
      return [];
    }
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const dockerEvidence = evidence.filter((e) => e.source === this.name() && e.type === "config");
    if (!dockerEvidence.length) return [];

    const artifacts: InferredArtifact[] = [];

    for (const ev of dockerEvidence) {
      const artifact = this.inferFromDockerEvidence(ev, context);
      if (artifact) {
        artifacts.push(artifact);
      }
    }

    return artifacts;
  }

  /**
   * Infer a Resource artifact from Docker evidence.
   * Always outputs kind "container".
   */
  private inferFromDockerEvidence(
    ev: Evidence,
    context: InferenceContext,
  ): InferredArtifact | null {
    const data = ev.data as unknown as DockerData;
    const projectRoot = context.projectRoot ?? context.fileIndex.root ?? "";
    const relativeDir =
      this.normalize(path.relative(projectRoot, path.dirname(ev.filePath))) || ".";

    const metadata: Record<string, unknown> = {
      sourceFile: projectRoot ? path.relative(projectRoot, ev.filePath) : ev.filePath,
      root: relativeDir === "." ? "" : relativeDir,
      configType: data.configType,
    };

    if (data.image) {
      metadata.image = data.image;
    }
    if (data.dockerfile) {
      metadata.dockerfile = data.dockerfile;
    }
    if (data.buildContext) {
      metadata.buildContext = data.buildContext;
    }
    if (data.ports && data.ports.length > 0) {
      metadata.ports = data.ports;
    }
    if (data.environment && Object.keys(data.environment).length > 0) {
      metadata.environment = data.environment;
    }

    return {
      artifact: {
        id: data.name,
        type: "infrastructure",
        name: data.name,
        description: data.description || "Docker container",
        tags: ["docker", "container"],
        metadata,
      },
      provenance: {
        evidence: [ev.id],
        plugins: [this.name()],
        rules: ["docker-parser"],
        timestamp: Date.now(),
        pipelineVersion: "2.0.0",
      },
      relationships: [],
    };
  }

  private parseDockerfile(content: string, filePath: string, projectRoot: string): Evidence[] {
    const dockerfileDir = path.dirname(filePath);
    const name = path.basename(dockerfileDir) || "docker-build";
    const evidenceId = path.relative(projectRoot, filePath);

    // Parse basic Dockerfile info
    const fromMatch = content.match(/^FROM\s+(\S+)/m);
    const exposeMatches = content.match(/^EXPOSE\s+(\d+)/gm);

    const ports: Array<{ port: number }> = [];
    if (exposeMatches) {
      for (const match of exposeMatches) {
        const portMatch = match.match(/EXPOSE\s+(\d+)/);
        if (portMatch) {
          ports.push({ port: parseInt(portMatch[1], 10) });
        }
      }
    }

    const data: DockerData = {
      name,
      description: "Docker build configuration",
      configType: "dockerfile",
      filePath,
      image: fromMatch?.[1],
      ports: ports.length > 0 ? ports : undefined,
      dockerfile: path.relative(projectRoot, filePath),
      buildContext: path.relative(projectRoot, dockerfileDir),
    };

    return [
      {
        id: evidenceId,
        source: this.name(),
        type: "config",
        filePath,
        data,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      },
    ];
  }

  private parseComposeFile(content: string, filePath: string, projectRoot: string): Evidence[] {
    const parsed = yaml.parse(content);
    if (!parsed || typeof parsed !== "object") return [];

    const evidence: Evidence[] = [];
    const services = parsed.services || {};

    for (const [serviceName, serviceConfig] of Object.entries(services)) {
      if (!serviceConfig || typeof serviceConfig !== "object") continue;

      const config = serviceConfig as Record<string, any>;
      const evidenceId = `${path.relative(projectRoot, filePath)}#${serviceName}`;

      // Parse ports
      const ports: Array<{ port: number; targetPort?: number }> = [];
      if (config.ports) {
        for (const portSpec of config.ports) {
          const parsed = this.parsePort(portSpec);
          if (parsed) ports.push(parsed);
        }
      }

      // Parse environment
      const environment: Record<string, string> = {};
      if (config.environment) {
        if (Array.isArray(config.environment)) {
          for (const env of config.environment) {
            const [key, value] = String(env).split("=");
            if (key) environment[key] = value || "";
          }
        } else if (typeof config.environment === "object") {
          Object.assign(environment, config.environment);
        }
      }

      const data: DockerData = {
        name: serviceName,
        description: `Docker Compose service: ${serviceName}`,
        configType: "docker-compose",
        filePath,
        image: config.image,
        ports: ports.length > 0 ? ports : undefined,
        environment: Object.keys(environment).length > 0 ? environment : undefined,
        volumes: config.volumes,
        buildContext: typeof config.build === "string" ? config.build : config.build?.context,
        dockerfile: typeof config.build === "object" ? config.build?.dockerfile : undefined,
      };

      evidence.push({
        id: evidenceId,
        source: this.name(),
        type: "config",
        filePath,
        data,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    }

    return evidence;
  }

  private parsePort(
    portSpec: string | number | Record<string, any>,
  ): { port: number; targetPort?: number } | null {
    if (typeof portSpec === "number") {
      return { port: portSpec };
    }

    if (typeof portSpec === "string") {
      // Handle "8080:80" or "8080"
      const parts = portSpec.split(":");
      if (parts.length === 2) {
        return {
          port: parseInt(parts[0], 10),
          targetPort: parseInt(parts[1], 10),
        };
      }
      return { port: parseInt(parts[0], 10) };
    }

    if (typeof portSpec === "object" && portSpec.target) {
      return {
        port: portSpec.published || portSpec.target,
        targetPort: portSpec.target,
      };
    }

    return null;
  }

  private normalize(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.\//, "");
  }
}

export const dockerPlugin = new DockerPlugin();
