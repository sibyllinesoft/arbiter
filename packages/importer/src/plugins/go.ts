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
  Provenance,
} from "../types";

// Go framework detection lists
const GO_WEB_FRAMEWORKS = ["gin", "echo", "fiber", "chi", "mux", "goji", "iris", "revel"];

const GO_CLI_FRAMEWORKS = ["cobra", "cli", "urfave/cli", "mitchellh/cli"];

const GO_JOB_FRAMEWORKS = ["cron", "gocron", "gronx"];

const GO_DATABASE_DRIVERS = [
  "gorm",
  "sqlx",
  "go-sql-driver/mysql",
  "lib/pq",
  "redis/go-redis",
  "mongo-driver/mongo",
];

export interface GoData extends Record<string, unknown> {
  name: string;
  description: string;
  type: string;
  filePath: string;
}

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
    let goMod;

    try {
      // Simple parsing for go.mod
      const lines = content.split("\n");
      const moduleLine = lines.find((line) => line.startsWith("module "));
      const goLine = lines.find((line) => line.startsWith("go "));
      const requireLines = lines.filter((line) => line.startsWith("\t") && line.includes(" "));

      const moduleName = moduleLine
        ? moduleLine.replace("module ", "").trim()
        : path.basename(path.dirname(filePath));
      const goVersion = goLine ? goLine.replace("go ", "").trim() : "1.0";

      const deps = requireLines.map((line) => {
        const parts = line.trim().split(" ");
        return parts[0].replace("\t", "");
      });

      const inferredType = this.determineGoType(deps);

      const goData: GoData = {
        name: moduleName,
        description: "Go package",
        type: inferredType,
        filePath,
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
    const artifacts: InferredArtifact[] = [];

    const artifact = {
      id: `go-${goData.type}-${name}`,
      type: goData.type as any,
      name,
      description: goData.description,
      tags: ["go", goData.type],
      metadata: {
        sourceFile: goData.filePath,
        language: "go",
      },
    };

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

  private determineGoType(deps: string[]): string {
    const hasWeb = deps.some((d) => GO_WEB_FRAMEWORKS.some((f) => d.includes(f)));
    const hasCli = deps.some((d) => GO_CLI_FRAMEWORKS.some((f) => d.includes(f)));
    const hasJob = deps.some((d) => GO_JOB_FRAMEWORKS.some((f) => d.includes(f)));

    if (hasWeb) return "service";
    if (hasCli) return "binary";
    if (hasJob) return "job";
    return "module";
  }
}

export const goPlugin = new GoPlugin();
