/**
 * Simplified Go Plugin for Package Detection
 *
 * Detects Go packages via go.mod. Outputs Package artifacts.
 * Does NOT try to classify service vs tool - that's for agents.
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
  filePath: string;
  dependencies?: string[];
  goVersion?: string;
}

/**
 * Simplified importer plugin for Go projects.
 * Parses go.mod and outputs Package artifacts.
 * Does NOT try to classify service vs tool - that's for agents.
 */
export class GoPlugin implements ImporterPlugin {
  name(): string {
    return "go";
  }

  supports(filePath: string): boolean {
    return path.basename(filePath) === "go.mod";
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    try {
      const lines = fileContent.split("\n");
      const moduleLine = lines.find((line) => line.startsWith("module "));
      const goLine = lines.find((line) => line.startsWith("go "));

      const moduleNameRaw = moduleLine
        ? moduleLine.replace("module ", "").trim()
        : path.basename(path.dirname(filePath));
      const moduleName = this.extractModuleName(moduleNameRaw);
      const goVersion = goLine ? goLine.replace("go ", "").trim() : undefined;

      // Parse dependencies from require block
      const deps = this.parseDependencies(fileContent);

      const baseId = path.relative(context?.projectRoot ?? process.cwd(), filePath);

      return [
        {
          id: baseId,
          source: this.name(),
          type: "config",
          filePath,
          data: {
            name: moduleName,
            description: "Go package",
            filePath,
            dependencies: deps,
            goVersion,
          } as GoData,
          metadata: {
            timestamp: Date.now(),
            fileSize: fileContent.length,
          },
        },
      ];
    } catch {
      return [];
    }
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const goEvidence = evidence.filter((e) => e.source === this.name() && e.type === "config");
    if (!goEvidence.length) return [];

    const artifacts: InferredArtifact[] = [];

    for (const goMod of goEvidence) {
      const artifact = this.inferFromGoMod(goMod, context);
      if (artifact) {
        artifacts.push(artifact);
      }
    }

    return artifacts;
  }

  /**
   * Infer a Package artifact from go.mod evidence.
   * Always outputs "package" - agents determine subtype later.
   */
  private inferFromGoMod(
    goModEvidence: Evidence,
    context: InferenceContext,
  ): InferredArtifact | null {
    const goData = goModEvidence.data as unknown as GoData;
    const name = goData.name;
    const projectRoot = context.projectRoot ?? context.fileIndex.root ?? "";
    const dir = path.dirname(goModEvidence.filePath);
    const relativeDir = this.normalize(path.relative(projectRoot, dir)) || ".";
    const dirCtx = context.directoryContexts.get(relativeDir) || context.directoryContexts.get(".");

    const metadata: Record<string, unknown> = {
      sourceFile: projectRoot
        ? path.relative(projectRoot, goModEvidence.filePath)
        : goModEvidence.filePath,
      root: relativeDir === "." ? "" : relativeDir,
      manifest: "go.mod",
      language: "go",
    };

    if (goData.goVersion) {
      metadata.goVersion = goData.goVersion;
    }

    // Include cmd/ info if present (useful for agents determining subtype)
    const filePatterns = dirCtx?.filePatterns ?? [];
    if (this.hasCmdEntrypoint(filePatterns)) {
      metadata.hasCmdDir = true;
    }

    return {
      artifact: {
        id: name,
        type: "package",
        name,
        description: goData.description || "Go package",
        tags: ["go"],
        metadata,
      },
      provenance: {
        evidence: [goModEvidence.id],
        plugins: [this.name()],
        rules: ["manifest-parser"],
        timestamp: Date.now(),
        pipelineVersion: "2.0.0",
      },
      relationships: [],
    };
  }

  private parseDependencies(content: string): string[] {
    const deps: string[] = [];
    const lines = content.split("\n");
    let inRequire = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("require (")) {
        inRequire = true;
        continue;
      }
      if (trimmed === ")") {
        inRequire = false;
        continue;
      }

      if (inRequire && trimmed) {
        const parts = trimmed.split(/\s+/);
        if (parts[0]) {
          deps.push(parts[0]);
        }
      }

      // Single-line require
      if (trimmed.startsWith("require ") && !trimmed.includes("(")) {
        const parts = trimmed.replace("require ", "").trim().split(/\s+/);
        if (parts[0]) {
          deps.push(parts[0]);
        }
      }
    }

    return deps;
  }

  private extractModuleName(modulePath: string): string {
    if (!modulePath) return "go-package";
    const parts = modulePath.split("/");
    return parts[parts.length - 1] || modulePath;
  }

  private hasCmdEntrypoint(filePatterns: string[]): boolean {
    return filePatterns.some((pattern) => pattern.startsWith("cmd/") || pattern === "cmd");
  }

  private normalize(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.\//, "");
  }
}

export const goPlugin = new GoPlugin();
