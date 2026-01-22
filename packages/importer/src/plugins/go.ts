/**
 * Simplified Go Plugin for Package Detection
 *
 * Detects Go packages via go.mod and guesses artifact type based on structure and dependencies.
 */

import * as path from "path";
import {
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
} from "../types";

export interface GoData extends Record<string, unknown> {
  name: string;
  description: string;
  type: string;
  filePath: string;
  dependencies?: string[];
  goVersion?: string;
}

/** Importer plugin for Go projects. Parses go.mod and Go source files. */
export class GoPlugin implements ImporterPlugin {
  name(): string {
    return "go";
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath);

    // Focus on go.mod and basic Go sources
    if (fileName === "go.mod") {
      return true;
    }

    if (extension === ".go") {
      return fileName === "main.go" || fileName === "main_test.go";
    }

    return false;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent || path.basename(filePath) !== "go.mod") return [];

    const evidence: Evidence[] = [];
    const baseId = path.relative(context?.projectRoot ?? process.cwd(), filePath);

    try {
      return this.parseGoMod(filePath, fileContent, baseId);
    } catch (error) {
      console.warn(`Go plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const goEvidence = evidence.filter((e) => e.source === "go");
    if (goEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];
    const goModEvidence = goEvidence.filter((e) => e.type === "config");

    for (const goMod of goModEvidence) {
      artifacts.push(...this.inferFromGoMod(goMod, evidence, context));
    }

    return artifacts;
  }

  // Parse go.mod
  private parseGoMod(filePath: string, content: string, baseId: string): Evidence[] {
    const evidence: Evidence[] = [];

    try {
      // Simple parsing for go.mod
      const lines = content.split("\n");
      const moduleLine = lines.find((line) => line.startsWith("module "));
      const goLine = lines.find((line) => line.startsWith("go "));
      const requireLines = lines.filter((line) => line.startsWith("\t") && line.includes(" "));

      const moduleNameRaw = moduleLine
        ? moduleLine.replace("module ", "").trim()
        : path.basename(path.dirname(filePath));
      const moduleName = this.extractModuleName(moduleNameRaw);
      const goVersion = goLine ? goLine.replace("go ", "").trim() : "1.0";

      const deps = requireLines
        .map((line) => {
          const parts = line.trim().split(" ");
          return parts[0].replace("\t", "");
        })
        .filter(Boolean);

      const goData: GoData = {
        name: moduleName,
        description: "Go package",
        type: "package",
        filePath,
        dependencies: deps,
        goVersion,
      };

      evidence.push({
        id: baseId,
        source: "go",
        type: "config",
        filePath,
        data: goData,
        metadata: { timestamp: Date.now(), fileSize: content.length },
      });
    } catch (error) {
      console.warn("Failed to parse go.mod:", error);
    }

    return evidence;
  }

  // Simplified inference
  private inferFromGoMod(
    goModEvidence: Evidence,
    allEvidence: Evidence[],
    context: InferenceContext,
  ): InferredArtifact[] {
    const goData = goModEvidence.data as unknown as GoData;
    const name = goData.name;
    const projectRoot = context.projectRoot ?? context.fileIndex.root ?? "";
    const dir = path.dirname(goModEvidence.filePath);
    const relativeDir = this.normalize(path.relative(projectRoot, dir)) || ".";
    const dirCtx =
      context.directoryContexts.get(relativeDir) || context.directoryContexts.get(".") || undefined;

    const dependencies = (goData.dependencies ?? []).map((d) => d.toLowerCase());
    const filePatterns = dirCtx?.filePatterns ?? [];
    const hasDocker = Boolean(dirCtx?.hasDockerfile || dirCtx?.hasComposeService);
    const dockerBuild = dirCtx?.dockerBuild;

    const classification = context.classifier.classify({
      dependencies,
      filePatterns,
      scripts: {},
      language: "go",
      hasDocker,
      hasBinaryEntry: this.hasCmdEntrypoint(filePatterns),
    });

    let inferredType = this.applyHeuristics(classification.type, filePatterns, hasDocker);
    const artifacts: InferredArtifact[] = [];

    const metadata: Record<string, unknown> = {
      sourceFile: goData.filePath,
      root: relativeDir === "." ? "" : relativeDir,
      manifest: "go.mod",
      language: "go",
      goVersion: goData.goVersion,
      classification,
    };

    const artifact = {
      id: `go-${inferredType}-${name}`,
      type: inferredType as any,
      name,
      description: goData.description,
      tags: Array.from(new Set<string>(["go", inferredType, ...classification.tags])),
      metadata,
    };

    if (dockerBuild) {
      metadata.buildContext = this.toRelative(projectRoot, dockerBuild.buildContext);
      metadata.dockerfilePath = this.toRelative(projectRoot, dockerBuild.dockerfile);
    }

    artifacts.push({
      artifact,
      provenance: {
        evidence: [goModEvidence.id],
        plugins: ["go"],
        rules: ["go-mod-simplification"],
        timestamp: Date.now(),
        pipelineVersion: "1.0.0",
      },
      relationships: [],
    });

    return artifacts;
  }

  /**
   * Normalizes a Go module path to a friendly service name by
   * stripping host/org prefixes (e.g., github.com/org/app -> app).
   */
  private extractModuleName(modulePath: string): string {
    if (!modulePath) return "go-service";
    const parts = modulePath.split("/");
    return parts[parts.length - 1] || modulePath;
  }

  private hasCmdEntrypoint(filePatterns: string[]): boolean {
    return filePatterns.some((pattern) => pattern.startsWith("cmd/") || pattern === "cmd");
  }

  private applyHeuristics(baseType: string, filePatterns: string[], hasDocker: boolean): string {
    if (hasDocker && baseType === "package") return "service";
    if (this.hasCmdEntrypoint(filePatterns) && baseType === "package") return "binary";
    const hasWeb = filePatterns.some((p) => p.includes("/handler") || p.includes("/server"));
    if (hasWeb && baseType === "package") return "service";
    return baseType;
  }

  private normalize(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.\//, "");
  }

  private toRelative(projectRoot: string, abs?: string): string | undefined {
    if (!abs) return undefined;
    if (!projectRoot) return abs;
    return this.normalize(path.relative(projectRoot, abs));
  }
}

export const goPlugin = new GoPlugin();
