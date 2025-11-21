import * as path from "path";
import * as fs from "fs-extra";
import * as yaml from "yaml";
import type {
  ConfidenceScore,
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
  Provenance,
} from "../types";
import type { ProjectMetadata } from "../types";

export interface DockerData {
  name: string;
  description: string;
  type: string;
  filePath: string;
  dockerfileContent?: string;
  composeServiceConfig?: Record<string, unknown>;
  composeServiceYaml?: string;
  [key: string]: unknown;
}

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
      basename.includes("compose")
    );
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) {
      throw new Error("File content required for Docker parsing");
    }

    const evidence: Evidence[] = [];
    const basename = path.basename(filePath).toLowerCase();

    try {
      let parsed;
      if (basename === "dockerfile") {
        // Don't use YAML for Dockerfile
        parsed = null;
      } else {
        parsed = yaml.parse(fileContent);
      }

      if (basename === "dockerfile") {
        // Parse Dockerfile
        const dockerfileEvidence = await this.parseDockerfile(
          fileContent,
          filePath,
          context?.projectRoot || "/",
        );
        evidence.push(...dockerfileEvidence);
      } else if (basename.includes("docker-compose")) {
        // Parse docker-compose.yml
        if (parsed && typeof parsed === "object") {
          const composeEvidence = this.parseDockerCompose(
            parsed,
            filePath,
            context?.projectRoot || "/",
          );
          evidence.push(...composeEvidence);
        }
      }

      return evidence;
    } catch (error) {
      console.warn(`Failed to parse Docker file ${filePath}:`, error);
      return [];
    }
  }

  private async parseDockerfile(
    content: string,
    filePath: string,
    projectRoot: string,
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Try to find a better name from adjacent package files
    const dockerfileDir = path.dirname(filePath);
    const name = await this.inferServiceNameFromDirectory(dockerfileDir);

    const data: DockerData = {
      name,
      description: "Docker build configuration",
      type: "dockerfile",
      filePath,
      dockerfileContent: content,
    };

    const evidenceId = path.relative(projectRoot, filePath);
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

    return evidence;
  }

  /**
   * Attempts to infer a service name from package files in the directory.
   * Checks for package.json, go.mod, Cargo.toml, pyproject.toml, etc.
   */
  private async inferServiceNameFromDirectory(dirPath: string): Promise<string> {
    // Package file priority order
    const packageFiles = [
      { file: "package.json", extractor: this.extractNameFromPackageJson },
      { file: "go.mod", extractor: this.extractNameFromGoMod },
      { file: "Cargo.toml", extractor: this.extractNameFromCargoToml },
      { file: "pyproject.toml", extractor: this.extractNameFromPyprojectToml },
      { file: "pom.xml", extractor: this.extractNameFromPomXml },
    ];

    for (const { file, extractor } of packageFiles) {
      const packagePath = path.join(dirPath, file);
      try {
        if (await fs.pathExists(packagePath)) {
          const content = await fs.readFile(packagePath, "utf-8");
          const name = extractor.call(this, content);
          if (name) {
            return name;
          }
        }
      } catch (error) {
        // Continue to next package file
        continue;
      }
    }

    // Fallback to directory name
    return path.basename(dirPath) || "docker-build";
  }

  private extractNameFromPackageJson(content: string): string | null {
    try {
      const pkg = JSON.parse(content);
      if (pkg.name && typeof pkg.name === "string") {
        // Remove scope prefix if present (@org/name -> name)
        return pkg.name.replace(/^@[^/]+\//, "");
      }
    } catch {
      // Invalid JSON
    }
    return null;
  }

  private extractNameFromGoMod(content: string): string | null {
    const match = content.match(/^module\s+([^\s\n]+)/m);
    if (match && match[1]) {
      // Extract last segment (github.com/user/repo -> repo)
      const segments = match[1].split("/");
      return segments[segments.length - 1];
    }
    return null;
  }

  private extractNameFromCargoToml(content: string): string | null {
    const match = content.match(/^\[package\][^[]*name\s*=\s*"([^"]+)"/ms);
    return match ? match[1] : null;
  }

  private extractNameFromPyprojectToml(content: string): string | null {
    const match = content.match(/^\[project\][^[]*name\s*=\s*"([^"]+)"/ms);
    if (match) return match[1];

    // Try poetry format
    const poetryMatch = content.match(/^\[tool\.poetry\][^[]*name\s*=\s*"([^"]+)"/ms);
    return poetryMatch ? poetryMatch[1] : null;
  }

  private extractNameFromPomXml(content: string): string | null {
    const match = content.match(/<artifactId>([^<]+)<\/artifactId>/);
    return match ? match[1] : null;
  }

  private parseDockerCompose(parsed: any, filePath: string, projectRoot: string): Evidence[] {
    const evidence: Evidence[] = [];

    const services = parsed.services;
    if (!services || typeof services !== "object") {
      return evidence;
    }

    const relativeComposePath = path.relative(projectRoot, filePath);

    for (const [serviceName, serviceConfigRaw] of Object.entries(services)) {
      const serviceConfig = serviceConfigRaw as any;
      if (typeof serviceConfig !== "object" || serviceConfig === null) continue;

      const evidenceId = relativeComposePath;
      const data: DockerData = {
        name: serviceName as string,
        description: "Docker service",
        type: "service",
        filePath,
        composeServiceConfig: serviceConfig,
        composeServiceYaml: yaml.stringify({ [serviceName]: serviceConfig }, { indent: 2 }),
      };

      evidence.push({
        id: evidenceId,
        source: this.name(),
        type: "config",
        filePath,
        data,
        metadata: {
          timestamp: Date.now(),
          fileSize: JSON.stringify(serviceConfig).length,
        },
      });
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];

    // Filter Docker evidence
    const dockerEvidence = evidence.filter((e) => e.source === this.name() && e.type === "config");

    const hasCompose = dockerEvidence.some((e) => e.filePath.toLowerCase().includes("compose"));

    for (const ev of dockerEvidence) {
      const data = ev.data as unknown as DockerData;
      if (data.type !== "service" && (hasCompose || data.type !== "dockerfile")) continue;

      const artifactType = data.type === "dockerfile" ? "service" : data.type;

      // Calculate relative path for root to match nodejs plugin behavior
      const projectRoot = context.projectRoot || "";
      const relativeFilePath = projectRoot
        ? path.relative(projectRoot, data.filePath)
        : data.filePath;
      const root = hasCompose ? path.basename(relativeFilePath) : path.dirname(relativeFilePath);

      const dockerMetadata: Record<string, unknown> = {};
      if (data.composeServiceConfig) {
        dockerMetadata.composeService = data.composeServiceConfig;
      }
      if (data.composeServiceYaml) {
        dockerMetadata.composeServiceYaml = data.composeServiceYaml;
      }
      const metadata: Record<string, unknown> = {
        sourceFile: relativeFilePath,
        root,
      };

      if (Object.keys(dockerMetadata).length > 0) {
        metadata.docker = dockerMetadata;
      }

      if (data.composeServiceConfig && typeof data.composeServiceConfig === "object") {
        const composeConfig = data.composeServiceConfig as Record<string, unknown>;
        if (typeof composeConfig.image === "string") {
          metadata.containerImage = composeConfig.image;
        }
        if (composeConfig.build !== undefined) {
          metadata.dockerBuild = composeConfig.build;
        }
      }

      if (data.dockerfileContent) {
        dockerMetadata.dockerfile = data.dockerfileContent;
        metadata.dockerfileContent = data.dockerfileContent;
      }

      if (relativeFilePath) {
        metadata.dockerfile = relativeFilePath;
      }

      const artifact = {
        id: `docker-${artifactType}-${data.name}`,
        type: artifactType as any,
        name: data.name,
        description: data.description,
        tags: ["docker", artifactType],
        metadata,
      };

      artifacts.push({
        artifact,
        provenance: {
          evidence: [ev.id],
          plugins: ["docker"],
          rules: ["docker-simplification"],
          timestamp: Date.now(),
          pipelineVersion: "1.0.0",
        },
        relationships: [],
      });
    }

    return artifacts;
  }
}
