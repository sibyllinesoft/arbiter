import * as path from "path";
import {
  type Evidence,
  type ImporterPlugin,
  type InferenceContext,
  type InferredArtifact,
  type ParseContext,
} from "../types";

export interface PackageJsonData extends Record<string, any> {
  name?: string;
  description?: string;
  fullPackage?: any;
  filePath: string;
}

/**
 * Simplified importer plugin for Node.js projects.
 * Parses package.json and outputs Package artifacts.
 * Does NOT try to classify service vs tool vs frontend - that's for agents.
 */
export class NodeJSPlugin implements ImporterPlugin {
  name(): string {
    return "nodejs";
  }

  supports(filePath: string): boolean {
    return path.basename(filePath) === "package.json";
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    try {
      const pkg = JSON.parse(fileContent);
      const packageName =
        typeof pkg.name === "string"
          ? this.stripScope(pkg.name)
          : path.basename(path.dirname(filePath));
      const projectRoot = context?.projectRoot ?? "";
      const evidenceId = projectRoot ? path.relative(projectRoot, filePath) : filePath;

      return [
        {
          id: evidenceId,
          source: this.name(),
          type: "config",
          filePath,
          data: {
            name: packageName,
            description: pkg.description ?? "",
            fullPackage: pkg,
            filePath,
          },
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
    const packageEvidence = evidence.filter((e) => e.source === this.name() && e.type === "config");
    if (!packageEvidence.length) return [];

    const artifacts: InferredArtifact[] = [];

    for (const pkgEv of packageEvidence) {
      const artifact = this.inferFromPackageEvidence(pkgEv, context);
      if (artifact) {
        artifacts.push(artifact);
      }
    }

    return artifacts;
  }

  /**
   * Infer a Package artifact from package.json evidence.
   * Always outputs "package" - agents determine subtype later.
   */
  private inferFromPackageEvidence(
    pkgEv: Evidence,
    context: InferenceContext,
  ): InferredArtifact | null {
    const pkg = (pkgEv.data as any).fullPackage ?? pkgEv.data;
    if (!pkg) return null;

    const projectRoot = context.projectRoot ?? context.fileIndex.root ?? "";
    const packageDir = path.dirname(pkgEv.filePath);
    const relativeDir = this.normalize(path.relative(projectRoot, packageDir)) || ".";

    const artifactName = this.resolveArtifactName(pkg, packageDir);
    const language = this.detectLanguage(pkg);
    const framework = this.detectFramework(pkg);

    const metadata: Record<string, unknown> = {
      sourceFile: projectRoot ? path.relative(projectRoot, pkgEv.filePath) : pkgEv.filePath,
      root: relativeDir === "." ? "" : relativeDir,
      manifest: "package.json",
      language,
    };

    if (framework) {
      metadata.framework = framework;
    }

    // Include bin info if present (useful for agents determining tool subtype)
    if (this.hasBinEntry(pkg)) {
      metadata.hasBin = true;
    }

    return {
      artifact: {
        id: artifactName,
        type: "package",
        name: artifactName,
        description: pkg.description || `Node.js package`,
        tags: ["nodejs", language],
        metadata,
      },
      provenance: {
        evidence: [pkgEv.id],
        plugins: [this.name()],
        rules: ["manifest-parser"],
        timestamp: Date.now(),
        pipelineVersion: "2.0.0",
      },
      relationships: [],
    };
  }

  /**
   * Detect language from package.json
   */
  private detectLanguage(pkg: any): string {
    const deps = this.collectDependencies(pkg);
    const scripts = pkg.scripts ?? {};

    // TypeScript indicators
    const tsSignals = ["typescript", "ts-node", "ts-node-dev", "tsx", "@swc/core"];
    if (tsSignals.some((name) => deps[name])) return "typescript";
    if (typeof pkg.types === "string" || typeof pkg.typings === "string") return "typescript";
    if (
      Object.values(scripts).some(
        (script) => typeof script === "string" && /ts(-node|x|\btsc\b)/.test(script),
      )
    ) {
      return "typescript";
    }

    return "javascript";
  }

  /**
   * Detect framework from dependencies (informational only)
   */
  private detectFramework(pkg: any): string | undefined {
    const deps = this.collectDependencies(pkg);
    const depNames = Object.keys(deps).map((d) => d.toLowerCase());

    // Just detect the primary framework for metadata
    const frameworkMap: [string[], string][] = [
      [["next"], "next"],
      [["react", "react-dom"], "react"],
      [["vue"], "vue"],
      [["svelte"], "svelte"],
      [["express"], "express"],
      [["fastify"], "fastify"],
      [["nest", "@nestjs/core"], "nest"],
      [["hono"], "hono"],
      [["koa"], "koa"],
    ];

    for (const [signals, framework] of frameworkMap) {
      if (signals.some((s) => depNames.includes(s))) {
        return framework;
      }
    }

    return undefined;
  }

  private collectDependencies(pkg: any): Record<string, string> {
    return {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
  }

  private hasBinEntry(pkg: any): boolean {
    if (!pkg) return false;
    if (typeof pkg.bin === "string") return pkg.bin.trim().length > 0;
    return pkg.bin && typeof pkg.bin === "object" && Object.keys(pkg.bin).length > 0;
  }

  private resolveArtifactName(pkg: any, packageDir: string): string {
    const rawName = typeof pkg.name === "string" ? pkg.name : path.basename(packageDir);
    return this.stripScope(rawName);
  }

  private normalize(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.\//, "");
  }

  private stripScope(value: string): string {
    if (!value) return value;
    return value.startsWith("@") ? value.split("/").pop() || value : value;
  }
}

export const nodejsPlugin = new NodeJSPlugin();
