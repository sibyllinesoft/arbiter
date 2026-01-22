import * as path from "path";
import {
  type ArtifactType,
  type Evidence,
  type ImporterPlugin,
  type InferenceContext,
  type InferredArtifact,
  type ParseContext,
} from "../types";

const FRONTEND_DEPS = ["react", "react-dom", "next", "vue", "svelte", "solid-js", "preact"];
const SERVER_DEPS = ["express", "fastify", "koa", "hapi", "nest", "hono", "restify"];
const CLI_DEPS = ["commander", "yargs", "inquirer", "ora", "chalk", "boxen", "cli-table3", "oclif"];
const SERVER_FILE_HINTS = [
  "server.",
  "server/",
  "/server",
  "api/",
  "/api/",
  "handler.",
  "handlers/",
];

export interface PackageJsonData extends Record<string, any> {
  name?: string;
  description?: string;
  fullPackage?: any;
  filePath: string;
  type?: string;
  private?: boolean;
  bin?: string | Record<string, string>;
  main?: string;
  types?: string;
  typings?: string;
  peerDependencies?: Record<string, string>;
  browserslist?: unknown;
}

interface HeuristicsContext {
  depsLower: Set<string>;
  hasMain: boolean;
  hasServerSignal: boolean;
  hasBin: boolean;
  hasFrontendDeps: boolean;
  hasBuildScript: boolean;
  hasCliDep: boolean;
}

/** Importer plugin for Node.js projects. Parses package.json and infers project type. */
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
   * Infer a single artifact from package.json evidence
   */
  private inferFromPackageEvidence(
    pkgEv: Evidence,
    context: InferenceContext,
  ): InferredArtifact | null {
    const pkg = (pkgEv.data as any).fullPackage ?? pkgEv.data;
    if (!pkg) return null;

    const inferenceData = this.buildInferenceData(pkg, pkgEv, context);
    const classification = this.classifyPackage(pkg, inferenceData, context);
    const artifactType = this.determineArtifactType(pkg, inferenceData, classification);
    const metadata = this.buildArtifactMetadata(pkgEv, inferenceData, classification);
    const artifactName = this.resolveArtifactName(pkg, inferenceData.packageDir);

    return {
      artifact: {
        id: artifactName,
        type: artifactType,
        name: artifactName,
        description: pkg.description || `Node.js ${artifactType}`,
        tags: Array.from(new Set<string>([...classification.tags, "nodejs", artifactType])),
        metadata,
      },
      provenance: {
        evidence: [pkgEv.id],
        plugins: [this.name()],
        rules: ["manifest-classifier"],
        timestamp: Date.now(),
        pipelineVersion: "1.1.0",
      },
      relationships: [],
    };
  }

  /**
   * Build inference data from package and context
   */
  private buildInferenceData(pkg: any, pkgEv: Evidence, context: InferenceContext) {
    const scripts = pkg.scripts ?? {};
    const dependenciesMap = this.collectDependencies(pkg);
    const dependencyNames = Object.keys(dependenciesMap);
    const projectRoot = context.projectRoot ?? context.fileIndex.root ?? "";
    const packageDir = path.dirname(pkgEv.filePath);
    const relativeDir = this.normalize(path.relative(projectRoot, packageDir)) || ".";
    const dirCtx =
      context.directoryContexts.get(relativeDir) || context.directoryContexts.get(".") || undefined;

    const depNamesLower = dependencyNames.map((d) => d.toLowerCase());
    const hasServerDeps = SERVER_DEPS.some((dep) => depNamesLower.includes(dep));
    const hasServerScriptFlag = this.hasServerScript(scripts);

    return {
      scripts,
      dependencyNames,
      projectRoot,
      packageDir,
      relativeDir,
      dirCtx,
      filePatterns: dirCtx?.filePatterns ?? [],
      hasDocker: Boolean(dirCtx?.hasDockerfile || dirCtx?.hasComposeService),
      usesTS: this.usesTypeScript(pkg, scripts),
      hasBin: this.hasBinEntry(pkg),
      dockerBuild: dirCtx?.dockerBuild,
      hasMain: typeof pkg?.main === "string" && pkg.main.trim().length > 0,
      hasServerSignal: hasServerScriptFlag && hasServerDeps,
    };
  }

  /**
   * Classify the package using the classifier
   */
  private classifyPackage(
    pkg: any,
    data: ReturnType<typeof this.buildInferenceData>,
    context: InferenceContext,
  ) {
    return context.classifier.classify({
      dependencies: data.dependencyNames,
      filePatterns: data.filePatterns,
      scripts: data.scripts,
      language: data.usesTS ? "typescript" : "javascript",
      hasDocker: data.hasDocker,
      hasBinaryEntry: data.hasBin,
    });
  }

  /**
   * Determine the final artifact type with heuristics and hard rules
   */
  private determineArtifactType(
    pkg: any,
    data: ReturnType<typeof this.buildInferenceData>,
    classification: { type: ArtifactType; tags: string[] },
  ): ArtifactType {
    let artifactType = this.applyIntentHeuristics(
      classification.type,
      pkg,
      data.scripts,
      data.dependencyNames,
    );

    // Hard rules: need a main entry AND both server deps and a server script to be a service
    if (!data.hasMain) {
      artifactType = data.hasBin ? "tool" : "package";
    } else if (artifactType === "service" && !data.hasServerSignal) {
      artifactType = "package";
    }

    return artifactType;
  }

  /**
   * Build metadata for the artifact
   */
  private buildArtifactMetadata(
    pkgEv: Evidence,
    data: ReturnType<typeof this.buildInferenceData>,
    classification: { type: ArtifactType; tags: string[] },
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      sourceFile: data.projectRoot
        ? path.relative(data.projectRoot, pkgEv.filePath)
        : pkgEv.filePath,
      root: data.relativeDir === "." ? "" : data.relativeDir,
      manifest: "package.json",
      language: data.usesTS ? "typescript" : "javascript",
      classification,
    };

    if (data.dockerBuild) {
      metadata.buildContext = this.toRelative(data.projectRoot, data.dockerBuild.buildContext);
      metadata.dockerfilePath = this.toRelative(data.projectRoot, data.dockerBuild.dockerfile);
    }

    if (data.hasDocker) {
      metadata.dockerContext = data.relativeDir;
    }

    return metadata;
  }

  /**
   * Resolve the artifact name from package.json or directory
   */
  private resolveArtifactName(pkg: any, packageDir: string): string {
    const rawName = typeof pkg.name === "string" ? pkg.name : path.basename(packageDir);
    return this.stripScope(rawName);
  }

  private collectDependencies(pkg: any): Record<string, string> {
    return {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.optionalDependencies || {}),
      ...(pkg.peerDependencies || {}),
    };
  }

  private usesTypeScript(pkg: any, scripts: Record<string, string>): boolean {
    const deps = this.collectDependencies(pkg);
    const tsSignals = ["typescript", "ts-node", "ts-node-dev", "tsx", "@swc/core"];
    if (tsSignals.some((name) => deps[name])) return true;
    if (typeof pkg.types === "string" || typeof pkg.typings === "string") return true;
    return Object.values(scripts).some(
      (script) => typeof script === "string" && /ts(-node|x|\btsc\b)/.test(script),
    );
  }

  private hasBinEntry(pkg: any): boolean {
    if (!pkg) return false;
    if (typeof pkg.bin === "string") return pkg.bin.trim().length > 0;
    return pkg.bin && typeof pkg.bin === "object" && Object.keys(pkg.bin).length > 0;
  }

  /**
   * Heuristics context for artifact type classification.
   */
  private buildHeuristicsContext(
    pkg: any,
    scripts: Record<string, string>,
    dependencyNames: string[],
  ): HeuristicsContext {
    const depsLower = new Set(dependencyNames.map((d) => d.toLowerCase()));
    const hasMain = typeof pkg?.main === "string" && pkg.main.trim().length > 0;
    const hasServerScriptFlag = this.hasServerScript(scripts);
    const hasServerDeps = SERVER_DEPS.some((dep) => depsLower.has(dep));

    return {
      depsLower,
      hasMain,
      hasServerSignal: hasServerScriptFlag && hasServerDeps,
      hasBin: this.hasBinEntry(pkg),
      hasFrontendDeps: FRONTEND_DEPS.some((dep) => depsLower.has(dep)),
      hasBuildScript: this.hasBuildScript(scripts),
      hasCliDep: CLI_DEPS.some((dep) => depsLower.has(dep)),
    };
  }

  /** Heuristic rules evaluated in priority order */
  private getHeuristicRules(baseType: ArtifactType): Array<{
    name: string;
    condition: (ctx: HeuristicsContext) => boolean;
    result: ArtifactType;
  }> {
    return [
      { name: "bin-entry", condition: (ctx) => ctx.hasBin, result: "tool" },
      {
        name: "server-signal",
        condition: (ctx) => ctx.hasMain && ctx.hasServerSignal,
        result: "service",
      },
      {
        name: "frontend",
        condition: (ctx) => ctx.hasFrontendDeps && ctx.hasBuildScript,
        result: "frontend",
      },
      { name: "cli-dep", condition: (ctx) => ctx.hasCliDep, result: "tool" },
      {
        name: "service-downgrade",
        condition: (ctx) => baseType === "service" && (!ctx.hasMain || !ctx.hasServerSignal),
        result: "package",
      },
    ];
  }

  /**
   * Apply heuristic rules to determine artifact type
   */
  private applyHeuristicRules(
    ctx: ReturnType<typeof this.buildHeuristicsContext>,
    baseType: ArtifactType,
  ): ArtifactType | null {
    const rules = this.getHeuristicRules(baseType);
    const matchedRule = rules.find((rule) => rule.condition(ctx));
    return matchedRule?.result ?? null;
  }

  private applyIntentHeuristics(
    baseType: ArtifactType,
    pkg: any,
    scripts: Record<string, string>,
    dependencyNames: string[],
  ): ArtifactType {
    const ctx = this.buildHeuristicsContext(pkg, scripts, dependencyNames);
    return this.applyHeuristicRules(ctx, baseType) ?? baseType;
  }

  private hasServerScript(scripts: Record<string, string>): boolean {
    const candidates = ["start", "serve", "dev"];
    return candidates.some((name) => {
      const command = scripts[name];
      if (typeof command !== "string") return false;
      return /(node|ts-node|tsx|nest|fastify|koa|hono|express|bun)/i.test(command);
    });
  }

  private hasBuildScript(scripts: Record<string, string>): boolean {
    const candidates = ["build", "vite", "webpack", "next", "nuxt"];
    return Object.values(scripts).some(
      (command) =>
        typeof command === "string" && candidates.some((token) => command.includes(token)),
    );
  }

  // Fallback for any cached references; we no longer rely on file hints.
  private hasServerFile(_filePatterns: string[]): boolean {
    return false;
  }

  private normalize(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.\//, "");
  }

  private stripScope(value: string): string {
    if (!value) return value;
    return value.startsWith("@") ? value.split("/").pop() || value : value;
  }

  private toRelative(projectRoot: string, abs?: string): string | undefined {
    if (!abs) return undefined;
    if (!projectRoot) return abs;
    return this.normalize(path.relative(projectRoot, abs));
  }
}

export const nodejsPlugin = new NodeJSPlugin();
