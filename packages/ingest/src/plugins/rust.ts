/**
 * Simplified Rust plugin for Package Detection
 *
 * Detects Rust packages via Cargo.toml. Outputs Package artifacts.
 * Does NOT try to classify service vs tool - that's for agents.
 */

import * as path from "path";
import { parse } from "@iarna/toml";
import {
  type Evidence,
  type ImporterPlugin,
  type InferenceContext,
  type InferredArtifact,
  type ParseContext,
} from "../types";

interface CargoEvidenceData extends Record<string, unknown> {
  configType: "cargo-toml";
  package?: {
    name?: string;
    version?: string;
    description?: string;
  };
  dependencies: string[];
  hasBinaries: boolean;
  hasLibrary: boolean;
}

/**
 * Simplified importer plugin for Rust projects.
 * Parses Cargo.toml and outputs Package artifacts.
 * Does NOT try to classify service vs tool - that's for agents.
 */
export class RustPlugin implements ImporterPlugin {
  name(): string {
    return "rust";
  }

  supports(filePath: string): boolean {
    return path.basename(filePath) === "Cargo.toml";
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    try {
      const cargo = parse(fileContent) as Record<string, any>;
      const packageInfo = cargo.package || {};
      const baseId = path.relative(context?.projectRoot ?? process.cwd(), filePath);

      // Collect dependency names
      const dependencies: string[] = [];
      if (cargo.dependencies) {
        dependencies.push(...Object.keys(cargo.dependencies));
      }
      if (cargo["dev-dependencies"]) {
        dependencies.push(...Object.keys(cargo["dev-dependencies"]));
      }

      // Check for binaries and library
      const hasBinaries = Boolean(cargo.bin) || this.hasMainRs(filePath);
      const hasLibrary = Boolean(cargo.lib) || this.hasLibRs(filePath);

      return [
        {
          id: baseId,
          source: this.name(),
          type: "config",
          filePath,
          data: {
            configType: "cargo-toml",
            package: {
              name: packageInfo.name,
              version: packageInfo.version,
              description: packageInfo.description,
            },
            dependencies,
            hasBinaries,
            hasLibrary,
          } as CargoEvidenceData,
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
    const rustEvidence = evidence.filter(
      (e) =>
        e.source === this.name() &&
        e.type === "config" &&
        (e.data as any).configType === "cargo-toml",
    );

    if (!rustEvidence.length) return [];

    const artifacts: InferredArtifact[] = [];

    for (const ev of rustEvidence) {
      const artifact = this.inferFromCargoEvidence(ev, context);
      if (artifact) {
        artifacts.push(artifact);
      }
    }

    return artifacts;
  }

  /**
   * Infer a Package artifact from Cargo.toml evidence.
   * Always outputs "package" - agents determine subtype later.
   */
  private inferFromCargoEvidence(ev: Evidence, context: InferenceContext): InferredArtifact | null {
    const data = ev.data as CargoEvidenceData;
    const projectRoot = context.projectRoot ?? context.fileIndex.root ?? "";
    const pkgDir = path.dirname(ev.filePath);
    const relativeDir = this.normalize(path.relative(projectRoot, pkgDir)) || ".";

    const artifactName = data.package?.name || path.basename(pkgDir);
    const framework = this.detectFramework(data.dependencies);

    const metadata: Record<string, unknown> = {
      sourceFile: projectRoot ? path.relative(projectRoot, ev.filePath) : ev.filePath,
      root: relativeDir === "." ? "" : relativeDir,
      manifest: "Cargo.toml",
      language: "rust",
    };

    if (framework) {
      metadata.framework = framework;
    }

    // Include hints for agents
    if (data.hasBinaries) {
      metadata.hasBinaries = true;
    }
    if (data.hasLibrary) {
      metadata.hasLibrary = true;
    }

    return {
      artifact: {
        id: artifactName,
        type: "package",
        name: artifactName,
        description: data.package?.description || "Rust package",
        tags: ["rust"],
        metadata,
      },
      provenance: {
        evidence: [ev.id],
        plugins: [this.name()],
        rules: ["manifest-parser"],
        timestamp: Date.now(),
        pipelineVersion: "2.0.0",
      },
      relationships: [],
    };
  }

  /**
   * Detect framework from dependencies (informational only)
   */
  private detectFramework(dependencies: string[]): string | undefined {
    const depsLower = dependencies.map((d) => d.toLowerCase());

    const frameworkMap: [string[], string][] = [
      [["axum"], "axum"],
      [["actix-web"], "actix"],
      [["rocket"], "rocket"],
      [["warp"], "warp"],
      [["tide"], "tide"],
      [["clap", "structopt", "argh"], "cli"],
      [["tokio"], "tokio"],
    ];

    for (const [signals, framework] of frameworkMap) {
      if (signals.some((s) => depsLower.includes(s))) {
        return framework;
      }
    }

    return undefined;
  }

  private hasMainRs(cargoPath: string): boolean {
    // Simple heuristic - assume main.rs exists if in standard location
    return true;
  }

  private hasLibRs(cargoPath: string): boolean {
    // Simple heuristic - can't know without filesystem check
    return false;
  }

  private normalize(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.\//, "");
  }
}

export const rustPlugin = new RustPlugin();
