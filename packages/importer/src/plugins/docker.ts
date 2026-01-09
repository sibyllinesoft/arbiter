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

    const basename = path.basename(filePath).toLowerCase();
    const projectRoot = context?.projectRoot || "/";

    try {
      if (basename === "dockerfile") {
        return this.parseDockerfile(fileContent, filePath, projectRoot);
      }

      if (basename.includes("docker-compose")) {
        return this.parseComposeFile(fileContent, filePath, projectRoot);
      }

      return [];
    } catch (error) {
      console.warn(`Failed to parse Docker file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Parse a docker-compose file and return evidence
   */
  private parseComposeFile(content: string, filePath: string, projectRoot: string): Evidence[] {
    const parsed = yaml.parse(content);
    if (!parsed || typeof parsed !== "object") {
      return [];
    }
    return this.parseDockerCompose(parsed, filePath, projectRoot);
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

  /**
   * Check if a compose service has a valid image specified
   */
  private hasValidImage(serviceConfig: Record<string, unknown>): boolean {
    return typeof serviceConfig?.image === "string" && serviceConfig.image.trim().length > 0;
  }

  /**
   * Build docker metadata for an artifact
   */
  private buildDockerMetadata(
    data: DockerData,
    buildPaths: { buildContextRel?: string; dockerfileRel?: string },
    projectRoot: string,
  ): Record<string, unknown> {
    const serviceConfig = data.composeServiceConfig as Record<string, unknown>;
    const dockerMetadata: Record<string, unknown> = {
      composeService: data.composeServiceConfig,
      composeServiceYaml: data.composeServiceYaml,
      composeFile: path.relative(projectRoot, data.filePath) || data.filePath,
      image: this.hasValidImage(serviceConfig) ? (serviceConfig.image as string) : undefined,
    };

    if (buildPaths.buildContextRel) {
      dockerMetadata.buildContext = buildPaths.buildContextRel;
    }
    if (buildPaths.dockerfileRel) {
      dockerMetadata.dockerfilePath = buildPaths.dockerfileRel;
    }

    return dockerMetadata;
  }

  /**
   * Build artifact metadata from docker metadata
   */
  private buildArtifactMetadata(
    dockerMetadata: Record<string, unknown>,
    data: DockerData,
  ): Record<string, unknown> {
    const image = (data.composeServiceConfig as any)?.image;
    return {
      sourceFile: dockerMetadata.composeFile,
      docker: dockerMetadata,
      external: true,
      composeOnly: true,
      containerImage: typeof image === "string" ? image : undefined,
    };
  }

  /**
   * Create an inferred artifact from compose service evidence
   */
  private createComposeArtifact(
    ev: Evidence,
    data: DockerData,
    dockerMetadata: Record<string, unknown>,
  ): InferredArtifact {
    return {
      artifact: {
        id: `compose-service-${data.name}`,
        type: "service" as const,
        name: data.name,
        description: "Service defined in docker-compose (no package manifest found)",
        tags: ["docker", "compose", "service", "external"],
        metadata: this.buildArtifactMetadata(dockerMetadata, data),
      },
      provenance: {
        evidence: [ev.id],
        plugins: ["docker"],
        rules: ["compose-external-service"],
        timestamp: Date.now(),
        pipelineVersion: "1.0.0",
      },
      relationships: [],
    };
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    // Only consider compose service evidence; ignore Dockerfiles for inference.
    const composeEvidence = evidence.filter(
      (e) =>
        e.source === this.name() &&
        e.type === "config" &&
        (e.data as DockerData)?.type === "service",
    );

    if (composeEvidence.length === 0) return [];

    const projectRoot = context.projectRoot || "";
    const packageEvidence = evidence.filter((e) => e.source === "nodejs" && e.type === "config");
    const artifacts: InferredArtifact[] = [];

    for (const ev of composeEvidence) {
      const data = ev.data as unknown as DockerData;
      const composeDir = path.dirname(data.filePath);
      const buildPaths = this.resolveBuildPaths(data.composeServiceConfig, composeDir, projectRoot);
      const serviceConfig = data.composeServiceConfig as Record<string, unknown>;

      const hasPackageManifest = this.composeHasPackageManifest(
        buildPaths.buildContextRel,
        composeDir === projectRoot ? "" : path.relative(projectRoot, composeDir) || ".",
        context.directoryContexts,
        packageEvidence,
        data.name,
        projectRoot,
      );

      // Skip emitting a service when a package manifest exists; package plugins will handle it.
      if (hasPackageManifest) continue;
      // Only emit compose-defined external services when an image is specified.
      if (!this.hasValidImage(serviceConfig)) continue;

      const dockerMetadata = this.buildDockerMetadata(data, buildPaths, projectRoot);
      artifacts.push(this.createComposeArtifact(ev, data, dockerMetadata));
    }

    return artifacts;
  }

  private resolveBuildPaths(
    buildConfig: any,
    composeDir: string,
    projectRoot: string,
  ): { buildContextRel?: string; dockerfileRel?: string } {
    let buildContextAbs: string | undefined;
    let dockerfileAbs: string | undefined;

    if (typeof buildConfig === "string") {
      buildContextAbs = path.resolve(composeDir, buildConfig);
      dockerfileAbs = path.join(buildContextAbs, "Dockerfile");
    } else if (buildConfig && typeof buildConfig === "object") {
      const contextVal = buildConfig.context;
      const dockerfileVal = buildConfig.dockerfile;

      buildContextAbs =
        typeof contextVal === "string" ? path.resolve(composeDir, contextVal) : composeDir;

      if (typeof dockerfileVal === "string") {
        dockerfileAbs = path.resolve(buildContextAbs, dockerfileVal);
      } else {
        dockerfileAbs = path.join(buildContextAbs, "Dockerfile");
      }
    }

    const rel = (abs?: string) =>
      abs ? path.relative(projectRoot, abs).replace(/\\/g, "/") : undefined;

    return {
      buildContextRel: rel(buildContextAbs),
      dockerfileRel: rel(dockerfileAbs),
    };
  }

  /**
   * Determines whether the compose service's build context (or compose dir) already
   * contains a package manifest, in which case we avoid emitting a duplicate service
   * and let language-specific plugins define it.
   */
  private composeHasPackageManifest(
    buildContextRel: string | undefined,
    composeDirRel: string,
    directoryContexts: Map<string, any>,
    packageEvidence: Evidence[],
    composeServiceName: string,
    projectRoot: string,
  ): boolean {
    const candidateKeys = this.buildCandidateKeys(buildContextRel, composeDirRel);

    // Check package evidence for matching name or location
    if (
      this.hasMatchingPackageEvidence(
        packageEvidence,
        composeServiceName,
        candidateKeys,
        projectRoot,
      )
    ) {
      return true;
    }

    // Check directory contexts for manifest files
    return this.hasManifestInDirectoryContexts(candidateKeys, directoryContexts);
  }

  /**
   * Build list of candidate directory keys to check
   */
  private buildCandidateKeys(buildContextRel: string | undefined, composeDirRel: string): string[] {
    const candidates = [buildContextRel, composeDirRel].filter(Boolean) as string[];
    return candidates.map((rel) => (rel === "" ? "." : rel));
  }

  /**
   * Check if any package evidence matches by name or location
   */
  private hasMatchingPackageEvidence(
    packageEvidence: Evidence[],
    composeServiceName: string,
    candidateKeys: string[],
    projectRoot: string,
  ): boolean {
    const normalizedServiceName = this.stripScope(composeServiceName || "");

    for (const ev of packageEvidence) {
      const pkg = (ev.data as any).fullPackage ?? ev.data;
      if (!pkg) continue;

      const pkgName = this.stripScope(pkg.name || "");
      if (pkgName && normalizedServiceName === pkgName) {
        return true;
      }

      if (this.isEvidenceInCandidateDir(ev, candidateKeys, projectRoot)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Strip npm scope from package name
   */
  private stripScope(value: string): string {
    return typeof value === "string" ? value.replace(/^@[^/]+\//, "") : value;
  }

  /**
   * Check if evidence file is in one of the candidate directories
   */
  private isEvidenceInCandidateDir(
    ev: Evidence,
    candidateKeys: string[],
    projectRoot: string,
  ): boolean {
    const filePath = ev.filePath || "";
    const relDir =
      path.relative(projectRoot, path.dirname(filePath)).replace(/\\/g, "/").replace(/^\.\//, "") ||
      ".";

    return candidateKeys.some((key) =>
      key === "." ? !relDir || relDir === "." : relDir === key || relDir.startsWith(`${key}/`),
    );
  }

  /**
   * Check if directory contexts contain manifest files
   */
  private hasManifestInDirectoryContexts(
    candidateKeys: string[],
    directoryContexts: Map<string, any>,
  ): boolean {
    const manifestNames = new Set([
      "package.json",
      "go.mod",
      "Cargo.toml",
      "pyproject.toml",
      "requirements.txt",
      "Pipfile",
      "Pipfile.lock",
      "poetry.lock",
      "setup.py",
    ]);

    for (const key of candidateKeys) {
      const ctx = directoryContexts.get(key);
      if (!ctx) continue;

      const patterns: string[] = ctx.filePatterns || [];
      const hasManifest = patterns.some((p) => manifestNames.has(p.split("/")[0] || p));
      if (hasManifest) return true;
    }

    return false;
  }
}
