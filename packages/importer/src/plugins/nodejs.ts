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
      const pkg = (pkgEv.data as any).fullPackage ?? pkgEv.data;
      if (!pkg) continue;

      const scripts = pkg.scripts ?? {};
      const dependenciesMap = this.collectDependencies(pkg);
      const dependencyNames = Object.keys(dependenciesMap);
      const projectRoot = context.projectRoot ?? context.fileIndex.root ?? "";
      const packageDir = path.dirname(pkgEv.filePath);
      const relativeDir = this.normalize(path.relative(projectRoot, packageDir)) || ".";
      const dirCtx =
        context.directoryContexts.get(relativeDir) ||
        context.directoryContexts.get(".") ||
        undefined;

      const filePatterns = dirCtx?.filePatterns ?? [];
      const hasDocker = Boolean(dirCtx?.hasDockerfile || dirCtx?.hasComposeService);
      const usesTS = this.usesTypeScript(pkg, scripts);
      const hasBin = this.hasBinEntry(pkg);
      const dockerBuild = dirCtx?.dockerBuild;

      const classification = context.classifier.classify({
        dependencies: dependencyNames,
        filePatterns,
        scripts,
        language: usesTS ? "typescript" : "javascript",
        hasDocker,
        hasBinaryEntry: hasBin,
      });

      let artifactType = classification.type;
      artifactType = this.applyIntentHeuristics(artifactType, pkg, scripts, dependencyNames);

      const metadata: Record<string, unknown> = {
        sourceFile: projectRoot ? path.relative(projectRoot, pkgEv.filePath) : pkgEv.filePath,
        root: relativeDir === "." ? "" : relativeDir,
        manifest: "package.json",
        language: usesTS ? "typescript" : "javascript",
        classification,
      };

      if (dockerBuild) {
        metadata.buildContext = this.toRelative(projectRoot, dockerBuild.buildContext);
        metadata.dockerfilePath = this.toRelative(projectRoot, dockerBuild.dockerfile);
      }

      if (hasDocker) {
        metadata.dockerContext = relativeDir;
      }

      const rawName = typeof pkg.name === "string" ? pkg.name : path.basename(packageDir);
      const artifactName = this.stripScope(rawName);

      const artifact = {
        id: artifactName,
        type: artifactType,
        name: artifactName,
        description: pkg.description || `Node.js ${artifactType}`,
        tags: Array.from(new Set<string>([...classification.tags, "nodejs", artifactType])),
        metadata,
      };

      artifacts.push({
        artifact,
        provenance: {
          evidence: [pkgEv.id],
          plugins: [this.name()],
          rules: ["manifest-classifier"],
          timestamp: Date.now(),
          pipelineVersion: "1.1.0",
        },
        relationships: [],
      });
    }

    return artifacts;
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

  private applyIntentHeuristics(
    baseType: ArtifactType,
    pkg: any,
    scripts: Record<string, string>,
    dependencyNames: string[],
  ): ArtifactType {
    const depsLower = new Set(dependencyNames.map((d) => d.toLowerCase()));

    if (this.hasBinEntry(pkg)) {
      return "tool";
    }

    if (this.hasServerScript(scripts)) {
      return "service";
    }

    const hasFrontendDeps = FRONTEND_DEPS.some((dep) => depsLower.has(dep));
    const hasBuildScript = this.hasBuildScript(scripts);
    if (hasFrontendDeps && hasBuildScript) {
      return "frontend";
    }

    const hasServerDeps = SERVER_DEPS.some((dep) => depsLower.has(dep));
    if (hasServerDeps) {
      return "service";
    }

    const hasCliDep = CLI_DEPS.some((dep) => depsLower.has(dep));
    if (hasCliDep) {
      return "tool";
    }

    return baseType;
  }

  private hasServerScript(scripts: Record<string, string>): boolean {
    const candidates = ["start", "serve", "dev"];
    return candidates.some((name) => {
      const command = scripts[name];
      if (typeof command !== "string") return false;
      return /(node|ts-node|tsx|nest|fastify|koa|hono|express)/i.test(command);
    });
  }

  private hasBuildScript(scripts: Record<string, string>): boolean {
    const candidates = ["build", "vite", "webpack", "next", "nuxt"];
    return Object.values(scripts).some(
      (command) =>
        typeof command === "string" && candidates.some((token) => command.includes(token)),
    );
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
