import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "js-yaml";
import ts from "typescript";
import type { ContentFetcher } from "./content-fetcher";
import { FetchQueue } from "./fetch-queue";
import type { ProjectStructure } from "./git-scanner.types";

export interface ArtifactLink {
  type: string;
  target: string;
  description?: string;
}

export interface AnalyzedArtifact {
  id: string;
  name: string;
  type: "service" | "database" | "infrastructure" | "config" | "tool" | "package" | "frontend";
  description: string;
  language: string | null;
  framework: string | null;
  metadata: Record<string, unknown>;
  filePath: string | null;
  links?: ArtifactLink[];
}

export interface TreeAnalysisResult {
  structure: ProjectStructure;
  artifacts: AnalyzedArtifact[];
  serviceCount: number;
  databaseCount: number;
}

interface StructureMetrics {
  filesScanned: number;
  usedGitLsFiles?: boolean;
}

const DOCKER_COMPOSE_FILES = new Set(["docker-compose.yml", "docker-compose.yaml"]);
const PACKAGE_MANIFESTS = new Set(["package.json", "bunfig.toml"]);
const DATABASE_HINTS = [
  "schema.prisma",
  "schema.sql",
  "migration.sql",
  "docker-compose.db",
  "docker-compose.database",
];
const KUBERNETES_KEYWORDS = [
  "deployment",
  "statefulset",
  "daemonset",
  "service",
  "configmap",
  "secret",
  "ingress",
  "namespace",
];

const ROUTE_HINT_PATTERN = /<Route\s|createBrowserRouter|createRoutesFromElements|react-router/;

const NODE_WEB_FRAMEWORKS = [
  "express",
  "fastify",
  "koa",
  "hapi",
  "nest",
  "adonis",
  "meteor",
  "sails",
  "loopback",
  "restify",
  "hono",
];

const NODE_FRONTEND_FRAMEWORKS = [
  "react",
  "react-dom",
  "next",
  "vue",
  "angular",
  "svelte",
  "solid-js",
  "preact",
  "nuxt",
  "gatsby",
];

const NODE_CLI_FRAMEWORKS = ["commander", "yargs", "inquirer", "oclif", "meow", "cac", "clipanion"];

const TYPESCRIPT_SIGNALS = ["typescript", "ts-node", "ts-node-dev", "tsx", "tsup", "@swc/core"];

const TSOA_ROUTE_PATTERN = /controller|route|api/i;

const RUST_WEB_FRAMEWORKS = [
  "axum",
  "warp",
  "actix-web",
  "rocket",
  "tide",
  "gotham",
  "nickel",
  "hyper",
  "poem",
  "salvo",
  "tower-web",
];

const RUST_CLI_FRAMEWORKS = ["clap", "structopt", "argh", "gumdrop"];

function normalizeSlashes(value: string): string {
  return value.replace(/\\+/g, "/");
}

function collectPackageDependencies(pkg: any): Record<string, string> {
  return {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.optionalDependencies || {}),
    ...(pkg.peerDependencies || {}),
  };
}

function detectPackageFrameworks(pkg: any): string[] {
  const deps = collectPackageDependencies(pkg);
  return NODE_WEB_FRAMEWORKS.filter((dep) => Boolean(deps[dep]));
}

function packageUsesTypeScript(pkg: any): boolean {
  const deps = collectPackageDependencies(pkg);
  if (TYPESCRIPT_SIGNALS.some((signal) => Boolean(deps[signal]))) {
    return true;
  }

  if (typeof pkg.types === "string" || typeof pkg.typings === "string") {
    return true;
  }

  const scripts = pkg.scripts || {};
  const scriptSignals = ["ts-node", "tsx", "ts-node-dev", "tsup", "tsc"];
  return Object.values(scripts)
    .filter((command): command is string => typeof command === "string")
    .some((command) => scriptSignals.some((signal) => command.includes(signal)));
}

function classifyPackageManifest(pkg: any): {
  type: "service" | "frontend" | "tool" | "package";
  detectedType: string;
  reason: string;
} {
  const deps = collectPackageDependencies(pkg);
  const depNames = Object.keys(deps).map((dep) => dep.toLowerCase());
  const runtimeDepNames = new Set<string>([
    ...Object.keys(pkg.dependencies || {}).map((dep) => dep.toLowerCase()),
    ...Object.keys(pkg.optionalDependencies || {}).map((dep) => dep.toLowerCase()),
    ...Object.keys(pkg.peerDependencies || {}).map((dep) => dep.toLowerCase()),
  ]);

  const hasRuntimeDependency = (candidates: string[]) =>
    candidates.some((candidate) => runtimeDepNames.has(candidate));
  const hasDependency = (candidates: string[]) =>
    candidates.some((candidate) => depNames.includes(candidate));

  if (hasRuntimeDependency(NODE_WEB_FRAMEWORKS)) {
    return {
      type: "service",
      detectedType: "web_service",
      reason: "web-framework",
    };
  }

  const hasFrontendFramework =
    hasRuntimeDependency(NODE_FRONTEND_FRAMEWORKS) || Boolean(pkg.browserslist);
  if (hasFrontendFramework) {
    return {
      type: "frontend",
      detectedType: "frontend",
      reason: "frontend-framework",
    };
  }

  const hasBin = Boolean(
    typeof pkg.bin === "string" || (pkg.bin && Object.keys(pkg.bin).length > 0),
  );
  const hasCliDependency = hasDependency(NODE_CLI_FRAMEWORKS);
  if (hasBin || hasCliDependency) {
    return {
      type: "tool",
      detectedType: "tool",
      reason: hasBin ? "manifest-bin" : "cli-dependency",
    };
  }

  return {
    type: "package",
    detectedType: "package",
    reason: "default-module",
  };
}

function detectNodePackageLanguage(pkg: any): string | null {
  const deps = collectPackageDependencies(pkg);
  const depNames = new Set<string>(Object.keys(deps).map((dep) => dep.toLowerCase()));
  const scripts = Object.values(pkg.scripts || {}).filter(
    (value): value is string => typeof value === "string",
  );
  const scriptBlob = scripts.join(" ").toLowerCase();

  const hasTypeScriptSignal =
    TYPESCRIPT_SIGNALS.some((signal) => depNames.has(signal)) ||
    /(?:\btsc\b|ts-node|tsx|typescript)/.test(scriptBlob) ||
    (typeof pkg.types === "string" && pkg.types.endsWith(".d.ts")) ||
    (typeof pkg.typings === "string" && pkg.typings.endsWith(".d.ts")) ||
    (typeof pkg.main === "string" && pkg.main.endsWith(".ts")) ||
    (typeof pkg.module === "string" && pkg.module.endsWith(".ts"));

  if (hasTypeScriptSignal) {
    return "TypeScript";
  }

  return null;
}

function normalizeCargoDependencyName(name: string): string {
  return name.toLowerCase().replace(/_/g, "-");
}

function collectCargoDependencyNames(cargo: any): string[] {
  const sections = ["dependencies", "dev-dependencies", "build-dependencies"];
  const names = new Set<string>();

  for (const section of sections) {
    const deps = cargo?.[section];
    if (!deps || typeof deps !== "object") continue;
    for (const key of Object.keys(deps)) {
      names.add(normalizeCargoDependencyName(key));
    }
  }

  return Array.from(names);
}

function extractCargoBinaryNames(binSection: unknown): string[] {
  if (!binSection) return [];

  if (Array.isArray(binSection)) {
    return binSection
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && typeof (entry as any).name === "string") {
          return (entry as any).name as string;
        }
        return null;
      })
      .filter((value): value is string => Boolean(value));
  }

  if (typeof binSection === "object") {
    const name = (binSection as Record<string, unknown>).name;
    if (typeof name === "string") {
      return [name];
    }
  }

  return [];
}

function classifyCargoManifest(options: {
  dependencyNames: string[];
  hasBinaries: boolean;
  hasLibrary: boolean;
}): {
  type: "service" | "package" | "tool";
  detectedType: "service" | "package" | "binary";
  reason: string;
  framework?: string;
} {
  const { dependencyNames, hasBinaries } = options;
  const normalizedDeps = dependencyNames.map(normalizeCargoDependencyName);

  const findMatch = (candidates: string[]): string | undefined => {
    return candidates.find((candidate) => normalizedDeps.includes(candidate));
  };

  const webFramework = findMatch(RUST_WEB_FRAMEWORKS);
  if (webFramework) {
    return {
      type: "service",
      detectedType: "service",
      reason: "web-framework",
      framework: webFramework,
    };
  }

  if (hasBinaries) {
    const cliFramework = findMatch(RUST_CLI_FRAMEWORKS);
    return {
      type: "tool",
      detectedType: "binary",
      reason: cliFramework ? "cli-binary" : "binary-target",
      framework: cliFramework,
    };
  }

  return {
    type: "package",
    detectedType: "package",
    reason: options.hasLibrary ? "library-target" : "default-module",
  };
}

function stripPackageRoot(filePath: string, packageRoot: string): string {
  if (!packageRoot) {
    return filePath;
  }
  if (filePath === packageRoot) {
    return "";
  }
  if (filePath.startsWith(`${packageRoot}/`)) {
    return filePath.slice(packageRoot.length + 1);
  }
  return filePath;
}

function buildTsoaAnalysisFromPackage(
  packageJsonPath: string,
  pkg: any,
  allFiles: string[],
): {
  root: string;
  frameworks: string[];
  usesTypeScript: true;
  hasTsoaDependency: boolean;
  totalTypeScriptFiles: number;
  controllerCandidates: string[];
  configFiles: string[];
  scriptsUsingTsoa: string[];
  recommendedCommands: string[];
} | null {
  const frameworks = detectPackageFrameworks(pkg);
  if (frameworks.length === 0) {
    return null;
  }

  if (!packageUsesTypeScript(pkg)) {
    return null;
  }

  const packageDir = normalizeSlashes(path.dirname(packageJsonPath));
  const normalizedRoot = packageDir === "." ? "" : packageDir;
  const deps = collectPackageDependencies(pkg);
  const hasTsoaDependency = Boolean(deps.tsoa);
  const scripts = pkg.scripts || {};

  const relevantFiles = allFiles
    .map(normalizeSlashes)
    .filter((file) => {
      if (file.endsWith(".d.ts")) return false;
      if (!normalizedRoot) {
        return !file.startsWith("node_modules/");
      }
      return file === normalizedRoot || file.startsWith(`${normalizedRoot}/`);
    })
    .map((file) => stripPackageRoot(file, normalizedRoot))
    .filter((rel) => rel && !rel.startsWith("node_modules/"));

  if (relevantFiles.length === 0) {
    return null;
  }

  const tsFiles = relevantFiles.filter((rel) => /\.(ts|tsx)$/i.test(rel));
  if (tsFiles.length === 0) {
    return null;
  }

  const controllerCandidates = tsFiles
    .filter((rel) => TSOA_ROUTE_PATTERN.test(rel))
    .filter((rel) => !/\.d\.ts$/i.test(rel))
    .filter((rel) => !/\btests?\//i.test(rel) && !/__tests__\//i.test(rel))
    .slice(0, 50);

  const configFiles = relevantFiles.filter((rel) => /tsoa\.json$/i.test(rel)).slice(0, 10);

  const scriptsUsingTsoa = Object.entries(scripts)
    .filter(([, command]) => typeof command === "string" && command.includes("tsoa"))
    .map(([name]) => name);

  if (controllerCandidates.length === 0 && configFiles.length === 0 && !hasTsoaDependency) {
    return null;
  }

  return {
    root: normalizedRoot || ".",
    frameworks,
    usesTypeScript: true,
    hasTsoaDependency,
    totalTypeScriptFiles: tsFiles.length,
    controllerCandidates,
    configFiles,
    scriptsUsingTsoa,
    recommendedCommands: hasTsoaDependency
      ? ["npx tsoa spec", "npx tsoa routes"]
      : ["npm install --save-dev tsoa", "npx tsoa spec", "npx tsoa routes"],
  };
}

export function buildProjectStructure(
  files: string[],
  metrics?: StructureMetrics,
): ProjectStructure {
  const structure: ProjectStructure = {
    hasPackageJson: false,
    hasCargoToml: false,
    hasDockerfile: false,
    hasCueFiles: false,
    hasYamlFiles: false,
    hasJsonFiles: false,
    importableFiles: [],
  };

  for (const file of files) {
    const lower = file.toLowerCase();
    const ext = path.extname(lower);
    const base = path.basename(lower);

    if (PACKAGE_MANIFESTS.has(base)) {
      structure.hasPackageJson = true;
      structure.importableFiles.push(file);
    } else if (base === "cargo.toml") {
      structure.hasCargoToml = true;
      structure.importableFiles.push(file);
    } else if (base === "dockerfile" || base.startsWith("dockerfile.")) {
      structure.hasDockerfile = true;
      structure.importableFiles.push(file);
    } else if (ext === ".cue") {
      structure.hasCueFiles = true;
      structure.importableFiles.push(file);
    } else if (ext === ".yaml" || ext === ".yml") {
      structure.hasYamlFiles = true;
      if (isInfrastructureYaml(base)) {
        structure.importableFiles.push(file);
      }
    } else if (ext === ".json") {
      structure.hasJsonFiles = true;
      if (isConfigJson(base)) {
        structure.importableFiles.push(file);
      }
    } else if (ext === ".tf" || ext === ".tf.json") {
      structure.importableFiles.push(file);
    }
  }

  if (metrics) {
    structure.performanceMetrics = {
      filesScanned: metrics.filesScanned,
      usedGitLsFiles: metrics.usedGitLsFiles,
    };
  }

  // Deduplicate importable files
  structure.importableFiles = Array.from(new Set(structure.importableFiles));
  return structure;
}

interface AnalysisOptions {
  gitUrl?: string;
  structure?: ProjectStructure;
  branch?: string;
  fetcher?: ContentFetcher;
  maxConcurrency?: number;
  projectRoot?: string;
}

export async function analyzeProjectFiles(
  projectId: string,
  projectName: string,
  files: string[],
  options: AnalysisOptions = {},
): Promise<TreeAnalysisResult> {
  const structure = options.structure ?? buildProjectStructure(files);
  const artifacts: AnalyzedArtifact[] = [];
  const artifactsByPath = new Map<string, AnalyzedArtifact>();

  for (const file of files) {
    const classified = classifyFile(projectId, file);
    if (!classified) continue;

    const enriched = {
      ...classified,
      metadata: {
        ...classified.metadata,
        detectedBy: "tree-analysis",
      },
    } satisfies AnalyzedArtifact;

    artifacts.push(enriched);
    artifactsByPath.set(file, enriched);
  }

  if (options.fetcher) {
    const queue = new FetchQueue(
      (path) => options.fetcher!.fetchText(path),
      options.maxConcurrency ?? 4,
    );
    const parseTargets = collectParserTargets(files);
    const parsePromises = parseTargets.map((target) =>
      queue.enqueue(target.path, target.priority).then(async (content) => {
        if (!content) return;
        await target.parser.parse(content, {
          projectId,
          projectName,
          filePath: target.path,
          artifact: artifactsByPath.get(target.path),
          addArtifact: (artifact) => {
            artifacts.push(artifact);
            if (artifact.filePath) {
              artifactsByPath.set(artifact.filePath, artifact);
            }
          },
          structure,
          allFiles: files,
        });
      }),
    );

    await Promise.all(parsePromises);
  }

  const artifactsByName = new Map<string, AnalyzedArtifact>();
  for (const artifact of artifacts) {
    artifactsByName.set(artifact.name, artifact);
    if (artifact.filePath) {
      artifactsByName.set(artifact.filePath, artifact);
    }
    const pkgMetadata = artifact.metadata?.package as { name?: string } | undefined;
    if (pkgMetadata?.name) {
      artifactsByName.set(pkgMetadata.name, artifact);
    }
  }

  if (options.projectRoot) {
    await annotateFrontendRoutes(
      artifacts,
      artifactsByPath,
      artifactsByName,
      options.projectRoot,
      projectName,
      files,
    );
  }

  for (const artifact of artifacts) {
    if (artifact.links && artifact.links.length > 0) {
      artifact.metadata = {
        ...artifact.metadata,
        links: artifact.links,
      };
    }
  }

  const serviceCount = artifacts.filter((a) => a.type === "service").length;
  const databaseCount = artifacts.filter((a) => a.type === "database").length;

  return {
    structure,
    artifacts,
    serviceCount,
    databaseCount,
  };
}

interface FrontendRouteInfo {
  path: string;
  filePath: string;
  routerType: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

async function annotateFrontendRoutes(
  artifacts: AnalyzedArtifact[],
  artifactsByPath: Map<string, AnalyzedArtifact>,
  artifactsByName: Map<string, AnalyzedArtifact>,
  projectRoot: string,
  projectName: string,
  files: string[],
): Promise<void> {
  try {
    const normalizedFiles = files.map(normalizeRelativePath);

    for (const artifact of artifacts) {
      const packageJsonPath = artifact.filePath?.endsWith("package.json")
        ? path.resolve(projectRoot, artifact.filePath)
        : null;

      if (!packageJsonPath) continue;

      const pkg = await readPackageManifest(packageJsonPath);
      if (!pkg) continue;

      const isFrontend = isFrontendArtifact(artifact, pkg);
      if (!isFrontend) continue;

      const packageRoot = path.dirname(packageJsonPath);
      const packageRelativeRoot = normalizeRelativePath(path.relative(projectRoot, packageRoot));
      const packageFiles = normalizedFiles.filter((relative) => {
        if (!packageRelativeRoot || packageRelativeRoot === ".") {
          return !relative.includes("node_modules/") && /\.(tsx?|jsx?)$/i.test(relative);
        }
        return relative === packageRelativeRoot || relative.startsWith(`${packageRelativeRoot}/`);
      });

      const candidateRelativeFiles = packageFiles.filter((relative) => {
        if (!/\.(tsx?|jsx?)$/i.test(relative)) return false;
        if (shouldIgnoreFrontendFile(relative)) return false;
        return true;
      });

      const routes: FrontendRouteInfo[] = [];

      routes.push(...extractNextRoutes(packageRelativeRoot, candidateRelativeFiles));

      for (const relativePath of candidateRelativeFiles) {
        const absolutePath = path.resolve(projectRoot, relativePath);
        let content: string;
        try {
          content = await fs.readFile(absolutePath, "utf-8");
        } catch {
          continue;
        }

        if (!ROUTE_HINT_PATTERN.test(content)) {
          continue;
        }

        routes.push(...extractReactRouterRoutes(content, relativePath));
      }

      const uniqueRoutes = deduplicateRoutes(routes);

      if (uniqueRoutes.length === 0) {
        continue;
      }

      const frameworks = detectFrontendFrameworks(pkg);
      const routeTree = buildRouteTree(pkg.name ?? artifact.name, uniqueRoutes);

      const normalizedRoutes = uniqueRoutes.map((route) => ({
        path: route.path,
        filePath: route.filePath,
        routerType: route.routerType,
        component: route.component,
        metadata: route.metadata,
      }));

      const routerTypeSummary = normalizedRoutes.some((route) => route.routerType === "next")
        ? "next"
        : "react-router";

      const analysis = {
        packageName: pkg.name ?? artifact.name,
        frameworks,
        components: [],
        routes: normalizedRoutes,
        routers: [
          {
            type: routerTypeSummary,
            routes: normalizedRoutes,
          },
        ],
        routeTree,
        scannedAt: new Date().toISOString(),
        source: "static-frontend-scanner",
      };

      const existingMetadata = artifact.metadata ?? {};
      artifact.type = "frontend";
      artifact.metadata = {
        ...existingMetadata,
        frontendAnalysis: analysis,
        detectedType: existingMetadata.detectedType ?? "frontend",
        classification: existingMetadata.classification ?? {
          source: "manifest",
          reason: "frontend-detection",
        },
      };

      artifactsByName.set(artifact.name, artifact);
      if (artifact.filePath) {
        artifactsByName.set(artifact.filePath, artifact);
      }
    }
  } catch (error) {
    console.warn("[project-analysis] frontend route enrichment failed", error);
  }
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\+/g, "/");
}

async function readPackageManifest(packageJsonPath: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(packageJsonPath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.warn("[project-analysis] failed to read package manifest", {
      packageJsonPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function isFrontendArtifact(artifact: AnalyzedArtifact, pkg: any): boolean {
  const explicitType = (artifact.type || "").toLowerCase();
  if (explicitType === "frontend") {
    return true;
  }
  const detectedType = String(artifact.metadata?.detectedType || "").toLowerCase();
  if (detectedType === "frontend") {
    return true;
  }

  const frameworks = detectFrontendFrameworks(pkg);
  if (frameworks.length > 0) {
    return true;
  }

  const scripts = Object.keys(pkg.scripts || {});
  return scripts.some((script) =>
    /next|vite|react-scripts|storybook|webpack-dev-server/i.test(script),
  );
}

function detectFrontendFrameworks(pkg: any): string[] {
  const frameworks = new Set<string>();
  const deps = collectDependencies(pkg);
  if (deps.has("next")) frameworks.add("next");
  if (deps.has("react")) frameworks.add("react");
  if (deps.has("react-router") || deps.has("react-router-dom")) frameworks.add("react-router");
  if (deps.has("vue") || deps.has("nuxt") || deps.has("@vue/runtime-dom")) frameworks.add("vue");
  if (deps.has("svelte") || deps.has("@sveltejs/kit")) frameworks.add("svelte");
  return Array.from(frameworks);
}

function collectDependencies(pkg: any): Set<string> {
  const depSources = [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.peerDependencies,
    pkg.optionalDependencies,
  ];
  const deps = new Set<string>();
  depSources.forEach((source) => {
    if (!source) return;
    for (const key of Object.keys(source)) {
      deps.add(key.toLowerCase());
    }
  });
  return deps;
}

const FRONTEND_FILE_IGNORE_PATTERNS = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)tests?(\/|$)/,
  /\.stories\.[tj]sx?$/,
  /(^|\/)stories?(\/|$)/,
  /(^|\/)storybook(\/|$)/,
  /(^|\/)test-results(\/|$)/,
  /(^|\/)dist(\/|$)/,
];

function shouldIgnoreFrontendFile(relativePath: string): boolean {
  return FRONTEND_FILE_IGNORE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function extractNextRoutes(packageRelativeRoot: string, files: string[]): FrontendRouteInfo[] {
  const routes: FrontendRouteInfo[] = [];
  const prefix =
    packageRelativeRoot && packageRelativeRoot !== "." ? `${packageRelativeRoot}/` : "";

  const seen = new Set<string>();

  for (const relative of files) {
    if (prefix && !relative.startsWith(prefix)) continue;
    const withinPackage = prefix ? relative.slice(prefix.length) : relative;
    const normalized = normalizeRelativePath(withinPackage);

    if (normalized.startsWith("node_modules/")) continue;

    if (normalized.startsWith("pages/")) {
      const routeInfo = deriveNextPagesRoute(normalized);
      if (routeInfo && !seen.has(routeInfo.key)) {
        seen.add(routeInfo.key);
        routes.push({
          path: routeInfo.path,
          filePath: prefix ? `${prefix}${routeInfo.relativeFile}` : routeInfo.relativeFile,
          routerType: "next",
          component: routeInfo.component,
          metadata: {
            kind: "next-pages",
            dynamic: routeInfo.dynamicSegments,
          },
        });
      }
    } else if (normalized.startsWith("app/")) {
      const routeInfo = deriveNextAppRoute(normalized);
      if (routeInfo && !seen.has(routeInfo.key)) {
        seen.add(routeInfo.key);
        routes.push({
          path: routeInfo.path,
          filePath: prefix ? `${prefix}${routeInfo.relativeFile}` : routeInfo.relativeFile,
          routerType: "next",
          component: routeInfo.component,
          metadata: {
            kind: "next-app",
            dynamic: routeInfo.dynamicSegments,
            segment: routeInfo.segment,
          },
        });
      }
    }
  }

  return routes;
}

function deriveNextPagesRoute(relativeFile: string): {
  key: string;
  path: string;
  component: string;
  relativeFile: string;
  dynamicSegments: string[];
} | null {
  if (!/\.(tsx|ts|jsx|js)$/i.test(relativeFile)) return null;
  if (relativeFile.endsWith(".d.ts")) return null;

  const withoutPrefix = relativeFile.replace(/^pages\//, "");
  const withoutExt = withoutPrefix.replace(/\.(tsx|ts|jsx|js)$/i, "");

  if (withoutExt === "_app" || withoutExt === "_document") return null;

  const segments = withoutExt.split("/").filter(Boolean);
  const dynamicSegments: string[] = [];
  const transformedSegments = segments.map((segment) =>
    transformNextSegment(segment, dynamicSegments),
  );
  const joined = transformedSegments.join("/");
  const pathValue =
    joined === "" || joined === "index" ? "/" : `/${joined.replace(/\/?index$/, "")}`;

  return {
    key: `${pathValue}@pages`,
    path: pathValue,
    component: withoutExt || "IndexPage",
    relativeFile,
    dynamicSegments,
  };
}

function deriveNextAppRoute(relativeFile: string): {
  key: string;
  path: string;
  component: string;
  relativeFile: string;
  dynamicSegments: string[];
  segment: string;
} | null {
  if (!/\.(tsx|ts|jsx|js)$/i.test(relativeFile)) return null;
  if (!relativeFile.endsWith("/page.tsx") && !relativeFile.endsWith("/page.ts")) return null;

  const withoutPrefix = relativeFile.replace(/^app\//, "");
  const withoutSuffix = withoutPrefix.replace(/\/page\.(tsx|ts)$/i, "");
  const segments = withoutSuffix.split("/").filter(Boolean);
  const dynamicSegments: string[] = [];
  const transformedSegments = segments.map((segment) =>
    transformNextSegment(segment, dynamicSegments),
  );
  const joined = transformedSegments.join("/");
  const pathValue = joined ? `/${joined}` : "/";

  return {
    key: `${pathValue}@app`,
    path: pathValue,
    component: segments.length ? segments[segments.length - 1] : "page",
    relativeFile,
    dynamicSegments,
    segment: withoutSuffix || "root",
  };
}

function transformNextSegment(segment: string, dynamicSegments: string[]): string {
  if (!segment) return segment;
  if (segment.startsWith("[[...") && segment.endsWith("]]")) {
    const name = segment.slice(4, -2);
    dynamicSegments.push(name);
    return `:${name}*?`;
  }
  if (segment.startsWith("[...") && segment.endsWith("]")) {
    const name = segment.slice(4, -1);
    dynamicSegments.push(name);
    return `:${name}*`;
  }
  if (segment.startsWith("[") && segment.endsWith("]")) {
    const name = segment.slice(1, -1);
    dynamicSegments.push(name);
    return `:${name}`;
  }
  return segment;
}

function extractReactRouterRoutes(content: string, relativePath: string): FrontendRouteInfo[] {
  const sourceFile = ts.createSourceFile(
    relativePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const routes: FrontendRouteInfo[] = [];
  const seen = new Set<string>();

  const recordRoute = (
    pathValue: string | undefined,
    component?: string,
    metadata?: Record<string, unknown>,
  ) => {
    if (!pathValue) return;
    let normalized = pathValue.trim();
    if (!normalized) return;
    if (normalized === "index") {
      normalized = "/";
    }
    if (!normalized.startsWith("/")) {
      normalized = `/${normalized.replace(/^\//, "")}`;
    }
    const key = `${relativePath}:${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);

    routes.push({
      path: normalized,
      filePath: relativePath,
      routerType: "react-router",
      component: component?.trim(),
      metadata: {
        ...metadata,
        source: "react-router-jsx",
      },
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      if (tagName === "Route") {
        const { path, component, meta } = extractRouteFromJsx(node, sourceFile);
        recordRoute(path, component, meta);
      }
    } else if (ts.isJsxElement(node)) {
      const tagName = node.openingElement.tagName.getText(sourceFile);
      if (tagName === "Route") {
        const { path, component, meta } = extractRouteFromJsx(node.openingElement, sourceFile);
        recordRoute(path, component, meta);
      }
    } else if (ts.isObjectLiteralExpression(node)) {
      const objectRoute = extractRouteFromObjectLiteral(node, sourceFile);
      if (objectRoute) {
        recordRoute(objectRoute.path, objectRoute.component, {
          ...objectRoute.metadata,
          source: "react-router-config",
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return routes;
}

function extractRouteFromJsx(
  element: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
): { path?: string; component?: string; meta: Record<string, unknown> } {
  const attributes = element.attributes.properties;
  const meta: Record<string, unknown> = {};
  let pathValue: string | undefined;
  let componentName: string | undefined;

  attributes.forEach((attr) => {
    if (!ts.isJsxAttribute(attr)) return;
    const attrName = attr.name.getText(sourceFile);
    if (attrName === "path") {
      pathValue = extractStringFromAttribute(attr, sourceFile);
    } else if (attrName === "index") {
      pathValue = pathValue ?? "index";
      meta.index = true;
    } else if (attrName === "element" || attrName === "Component" || attrName === "component") {
      componentName = extractComponentName(attr, sourceFile);
    } else if (attr.initializer) {
      const rawValue = attr.initializer.getText(sourceFile);
      meta[attrName] = rawValue;
    }
  });

  return { path: pathValue, component: componentName, meta };
}

function extractRouteFromObjectLiteral(
  node: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
): { path?: string; component?: string; metadata: Record<string, unknown> } | null {
  let pathValue: string | undefined;
  let componentName: string | undefined;
  const metadata: Record<string, unknown> = {};

  node.properties.forEach((property) => {
    if (!ts.isPropertyAssignment(property)) return;
    const name =
      property.name && ts.isIdentifier(property.name)
        ? property.name.text
        : property.name?.getText(sourceFile);
    if (!name) return;

    if (name === "path") {
      pathValue = extractStringFromExpression(property.initializer, sourceFile);
    } else if (name === "element" || name === "Component" || name === "component") {
      componentName = extractComponentFromExpression(property.initializer, sourceFile);
    } else {
      metadata[name] = property.initializer.getText(sourceFile);
    }
  });

  if (!pathValue) {
    return null;
  }

  return { path: pathValue, component: componentName, metadata };
}

function extractStringFromAttribute(
  attr: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (!attr.initializer) return undefined;
  if (ts.isStringLiteral(attr.initializer)) {
    return attr.initializer.text;
  }
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    return extractStringFromExpression(attr.initializer.expression, sourceFile);
  }
  return undefined;
}

function extractStringFromExpression(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (ts.isStringLiteral(expression)) {
    return expression.text;
  }
  if (ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  if (ts.isTemplateExpression(expression)) {
    if (!expression.templateSpans.length) {
      return expression.head.text;
    }
    return expression.getText(sourceFile);
  }
  return undefined;
}

function extractComponentName(
  attr: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (!attr.initializer || !ts.isJsxExpression(attr.initializer)) return undefined;
  if (!attr.initializer.expression) return undefined;
  return extractComponentFromExpression(attr.initializer.expression, sourceFile);
}

function extractComponentFromExpression(
  exp: ts.Expression,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (ts.isJsxElement(exp)) {
    return exp.openingElement.tagName.getText(sourceFile);
  }
  if (ts.isJsxSelfClosingElement(exp)) {
    return exp.tagName.getText(sourceFile);
  }
  if (ts.isIdentifier(exp)) {
    return exp.text;
  }
  if (ts.isCallExpression(exp)) {
    return exp.expression.getText(sourceFile);
  }
  return exp.getText(sourceFile);
}

function deduplicateRoutes(routes: FrontendRouteInfo[]): FrontendRouteInfo[] {
  const map = new Map<string, FrontendRouteInfo>();
  routes.forEach((route) => {
    const key = `${route.path}::${route.filePath}`;
    if (!map.has(key)) {
      map.set(key, route);
    }
  });
  return Array.from(map.values());
}

function buildRouteTree(packageName: string, routes: FrontendRouteInfo[]) {
  return {
    name: packageName,
    children: routes.map((route) => ({
      id: `${packageName}:${route.path}`,
      label: route.path,
      routerType: route.routerType,
      component: route.component ?? null,
      filePath: route.filePath,
      metadata: route.metadata ?? {},
    })),
  };
}

function classifyFile(projectId: string, filePath: string): AnalyzedArtifact | null {
  const lower = filePath.toLowerCase();
  const base = path.basename(lower);
  const ext = path.extname(lower);
  const name = prettifyName(filePath);
  const id = makeArtifactId(projectId, filePath);

  if (base === "package.json") {
    // Don't classify package.json here - let the proper manifest analysis handle it
    return null;
  }

  if (base === "cargo.toml") {
    // Don't classify Cargo.toml here - let the proper manifest analysis handle it
    return null;
  }

  if (base === "dockerfile" || base.startsWith("dockerfile.")) {
    // Dockerfiles are infrastructure, not services
    return {
      id,
      name: `${name}-container`,
      type: "infrastructure",
      description: "Dockerfile detected for containerized deployment.",
      language: null,
      framework: null,
      metadata: {
        filePath,
        dockerfile: true,
      },
      filePath,
      links: [],
    };
  }

  if (DOCKER_COMPOSE_FILES.has(base)) {
    const displayName = path.basename(filePath);
    return {
      id,
      name: displayName,
      type: "infrastructure",
      description: `Docker Compose configuration detected in ${displayName}.`,
      language: null,
      framework: null,
      metadata: {
        filePath,
        compose: true,
      },
      filePath,
      links: [],
    };
  }

  if (ext === ".cue") {
    return {
      id,
      name: `${name}-cue`,
      type: "config",
      description: "CUE configuration file detected.",
      language: null,
      framework: null,
      metadata: {
        filePath,
        cue: true,
      },
      filePath,
      links: [],
    };
  }

  if ((ext === ".yaml" || ext === ".yml") && isInfrastructureYaml(base)) {
    return {
      id,
      name: `${name}-k8s`,
      type: "infrastructure",
      description: "Infrastructure definition detected from YAML.",
      language: null,
      framework: null,
      metadata: {
        filePath,
        kubernetes: true,
      },
      filePath,
      links: [],
    };
  }

  if (ext === ".tf" || ext === ".tf.json") {
    return {
      id,
      name: `${name}-terraform`,
      type: "infrastructure",
      description: "Terraform IaC file detected.",
      language: null,
      framework: null,
      metadata: {
        filePath,
        terraform: true,
      },
      filePath,
      links: [],
    };
  }

  if (DATABASE_HINTS.some((hint) => lower.includes(hint))) {
    return {
      id,
      name: `${name}-database`,
      type: "database",
      description: "Database-related definition detected.",
      language: null,
      framework: null,
      metadata: {
        filePath,
        hint: "database-file-name",
      },
      filePath,
      links: [],
    };
  }

  return null;
}

function makeArtifactId(projectId: string, filePath: string): string {
  const hash = createHash("sha1").update(`${projectId}:${filePath}`).digest("hex");
  return `artifact-${hash}`;
}

function prettifyName(filePath: string): string {
  const base = path.basename(filePath);
  const withoutExt = base.replace(path.extname(base), "");
  return (
    withoutExt
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "artifact"
  );
}

function isInfrastructureYaml(base: string): boolean {
  if (DOCKER_COMPOSE_FILES.has(base)) {
    return true;
  }

  return KUBERNETES_KEYWORDS.some((keyword) => base.includes(keyword));
}

function isConfigJson(base: string): boolean {
  return base === "package.json" || base.endsWith("config.json") || base.includes("manifest");
}

interface ParserContext {
  projectId: string;
  projectName: string;
  filePath: string;
  artifact?: AnalyzedArtifact;
  addArtifact: (artifact: AnalyzedArtifact) => void;
  structure: ProjectStructure;
  allFiles: string[];
}

interface ParserDefinition {
  name: string;
  matches: (filePath: string) => boolean;
  priority: number;
  parse: (content: string, context: ParserContext) => void | Promise<void>;
}

const PARSERS: ParserDefinition[] = [
  {
    name: "dockerfile",
    matches: (filePath) => path.basename(filePath).toLowerCase().startsWith("dockerfile"),
    priority: 10,
    parse: (content, context) => {
      const artifact = context.artifact;
      if (!artifact) return;

      const lines = content.split(/\r?\n/);
      const metadata: Record<string, unknown> = { ...(artifact.metadata ?? {}) };

      const normalizedContent = content?.trimEnd();
      if (normalizedContent) {
        metadata.dockerfileContent = normalizedContent;
      }

      const fromLine = lines.find((line) => /^\s*FROM\s+/i.test(line));
      if (fromLine) {
        const baseImage = fromLine.replace(/^\s*FROM\s+/i, "").split("s")[0];
        metadata.baseImage = baseImage;
      }

      const exposePorts = lines
        .filter((line) => /^\s*EXPOSE\s+/i.test(line))
        .flatMap((line) => line.replace(/^\s*EXPOSE\s+/i, "").split(/\s+/))
        .filter(Boolean);

      if (exposePorts.length > 0) {
        metadata.exposedPorts = exposePorts;
      }

      artifact.metadata = metadata;
    },
  },
  {
    name: "docker-compose",
    matches: (filePath) => DOCKER_COMPOSE_FILES.has(path.basename(filePath).toLowerCase()),
    priority: 9,
    parse: (content, context) => {
      let parsedYaml: any;
      try {
        parsedYaml = YAML.load(content);
      } catch {
        return;
      }

      const artifact = context.artifact;
      if (!artifact) return;

      if (typeof parsedYaml !== "object" || parsedYaml === null) return;

      const servicesSection = parsedYaml.services;
      if (!servicesSection || typeof servicesSection !== "object") return;

      const serviceKeys = Object.keys(servicesSection);
      const composeServices: Array<Record<string, unknown>> = [];
      const composeServicesDetailed: Array<Record<string, unknown>> = [];

      for (const serviceName of serviceKeys) {
        const service = servicesSection[serviceName];
        if (!service || typeof service !== "object") continue;

        let serviceYaml: string | undefined;
        try {
          serviceYaml = YAML.dump({ [serviceName]: service }, { indent: 2 })?.trim();
        } catch {
          serviceYaml = undefined;
        }

        const serviceArtifact: AnalyzedArtifact = {
          id: makeArtifactId(context.projectId, `${context.filePath}#${serviceName}`),
          name: serviceName,
          type: "service",
          description: `Service defined in docker-compose file ${context.filePath}`,
          language: null,
          framework: null,
          metadata: {
            composeFile: context.filePath,
            service: serviceName,
            image: service.image,
            ports: service.ports,
            environment: service.environment,
            build: service.build,
            dependsOn: service.depends_on ?? service.dependsOn,
            composeService: service,
            composeServiceYaml: serviceYaml,
          },
          filePath: context.filePath,
          links: [
            {
              type: "defined_in",
              target: context.filePath,
            },
          ],
        };

        context.addArtifact(serviceArtifact);
        composeServices.push({
          service: serviceName,
          image: service.image,
          ports: service.ports,
          composeServiceYaml: serviceYaml,
          composeService: service,
        });

        composeServicesDetailed.push({
          service: serviceName,
          yaml: serviceYaml,
          config: service,
        });
      }

      artifact.metadata = {
        ...artifact.metadata,
        services: composeServices,
        composeServicesDetailed,
        composeYaml:
          typeof content === "string" ? content.trim() : YAML.dump(parsedYaml, { indent: 2 }),
      };
    },
  },
  {
    name: "package-json",
    matches: (filePath) => path.basename(filePath).toLowerCase() === "package.json",
    priority: 8,
    parse: (content, context) => {
      const artifact = context.artifact;
      if (!artifact) return;

      try {
        const pkg = JSON.parse(content);
        const manifestDescription =
          typeof pkg.description === "string" ? pkg.description.trim() : "";
        const manifestVersion = typeof pkg.version === "string" ? pkg.version.trim() : "";
        artifact.metadata = {
          ...artifact.metadata,
          package: {
            name: pkg.name,
            version: manifestVersion || undefined,
            description: manifestDescription || undefined,
            scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
            dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
            devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies) : [],
          },
        };

        if (typeof pkg.name === "string") {
          artifact.name = pkg.name;
        }
        if (manifestDescription) {
          artifact.description = manifestDescription;
        }
        if (pkg.dependencies) {
          if (pkg.dependencies.express) artifact.framework = "express";
          if (pkg.dependencies.fastify) artifact.framework = "fastify";
          if (pkg.dependencies.nestjs) artifact.framework = "nestjs";
        }

        console.log("[project-analysis] parsed package manifest", {
          path: context.filePath,
          originalType: artifact.type,
        });

        const detectedLanguage = detectNodePackageLanguage(pkg);
        if (detectedLanguage) {
          artifact.language = detectedLanguage;
        }

        const classification = classifyPackageManifest(pkg);
        if (classification) {
          const previousType = artifact.type;
          artifact.type = classification.type;
          artifact.metadata = {
            ...artifact.metadata,
            detectedType: classification.detectedType,
            classification: {
              source: "manifest",
              reason: classification.reason,
              previousType,
            },
          };
          if (classification.type === "tool" && !artifact.framework) {
            artifact.framework = "cli";
          }
          console.log("[project-analysis] classified package", {
            path: context.filePath,
            name: pkg.name,
            type: artifact.type,
            detectedType: classification.detectedType,
            reason: classification.reason,
          });
        }

        const tsoaAnalysis = buildTsoaAnalysisFromPackage(context.filePath, pkg, context.allFiles);
        if (tsoaAnalysis) {
          artifact.metadata = {
            ...artifact.metadata,
            tsoaAnalysis,
          };
        }
      } catch {
        // ignore parse errors
      }
    },
  },
  {
    name: "cargo-toml",
    matches: (filePath) => path.basename(filePath).toLowerCase() === "cargo.toml",
    priority: 8,
    parse: (content, context) => {
      const artifact = context.artifact;
      if (!artifact) return;

      const tomlParser = (globalThis as unknown as { Bun?: typeof Bun }).Bun?.TOML;
      if (!tomlParser || typeof tomlParser.parse !== "function") {
        console.warn("[project-analysis] TOML parser not available in runtime");
        return;
      }

      let cargo: Record<string, any>;
      try {
        cargo = tomlParser.parse(content) as Record<string, any>;
      } catch (error) {
        console.warn("[project-analysis] failed to parse Cargo manifest", {
          path: context.filePath,
          error,
        });
        return;
      }

      if (!cargo || typeof cargo !== "object") {
        return;
      }

      const packageSection = cargo.package ?? {};
      const manifestName =
        typeof packageSection.name === "string" ? packageSection.name.trim() : "";
      const manifestDescription =
        typeof packageSection.description === "string" ? packageSection.description.trim() : "";
      const manifestVersion =
        typeof packageSection.version === "string" ? packageSection.version.trim() : "";

      if (manifestName) {
        artifact.name = manifestName;
      }
      if (manifestDescription) {
        artifact.description = manifestDescription;
      }

      artifact.language = "rust";

      const runtimeDeps = Object.keys((cargo.dependencies as Record<string, unknown>) ?? {});
      const devDeps = Object.keys((cargo["dev-dependencies"] as Record<string, unknown>) ?? {});
      const buildDeps = Object.keys((cargo["build-dependencies"] as Record<string, unknown>) ?? {});
      const dependencyNames = collectCargoDependencyNames(cargo);

      const rawBin = cargo.bin ?? cargo.binaries ?? cargo["bin"];
      const cargoBinaries = extractCargoBinaryNames(rawBin);
      const hasBinaries =
        cargoBinaries.length > 0 ||
        Boolean(packageSection["default-run"]) ||
        Boolean(packageSection["default_bin"]);
      const hasLibrary = Boolean(cargo.lib);

      const classification = classifyCargoManifest({
        dependencyNames,
        hasBinaries,
        hasLibrary,
      });

      const previousType = artifact.type;
      if (classification.framework) {
        artifact.framework = classification.framework;
      }

      artifact.type = classification.type;

      if (classification.type === "tool" && cargoBinaries.length > 0) {
        artifact.name = cargoBinaries[0];
      }

      artifact.metadata = {
        ...artifact.metadata,
        detectedType: classification.detectedType,
        classification: {
          source: "cargo-manifest",
          reason: classification.reason,
          previousType,
        },
        cargo: {
          name: manifestName || artifact.name,
          version: manifestVersion || undefined,
          description: manifestDescription || undefined,
          dependencies: runtimeDeps,
          devDependencies: devDeps,
          buildDependencies: buildDeps,
          hasLibrary,
          hasBinaries,
          binaries: cargoBinaries,
        },
      };

      if (manifestVersion) {
        artifact.metadata.version = manifestVersion;
      }
    },
  },
  {
    name: "prisma",
    matches: (filePath) => path.basename(filePath).toLowerCase().includes("schema.prisma"),
    priority: 6,
    parse: (content, context) => {
      const artifact = context.artifact;
      if (!artifact) return;

      const datasourceMatch = content.match(
        /datasource\s+\w+\s+\{[\s\S]*?provider\s*=\s*"([^"]+)"/,
      );
      if (datasourceMatch) {
        artifact.metadata = {
          ...artifact.metadata,
          prismaProvider: datasourceMatch[1],
        };
        artifact.type = "database";
        artifact.description = `Database schema (provider: ${datasourceMatch[1]})`;
      }
    },
  },
  {
    name: "kubernetes",
    matches: (filePath) => {
      const base = path.basename(filePath).toLowerCase();
      if (!(base.endsWith(".yaml") || base.endsWith(".yml"))) return false;
      return isInfrastructureYaml(base);
    },
    priority: 5,
    parse: (content, context) => {
      const artifact = context.artifact;
      if (!artifact) return;

      try {
        const documents = YAML.loadAll(content).filter(Boolean) as any[];
        const summaries = documents
          .filter((doc) => typeof doc === "object")
          .map((doc) => ({
            kind: doc.kind,
            name: doc.metadata?.name,
          }));

        if (summaries.length > 0) {
          artifact.metadata = {
            ...artifact.metadata,
            kubernetesResources: summaries,
          };
        }
      } catch {
        // ignore
      }
    },
  },
  {
    name: "terraform",
    matches: (filePath) => {
      const base = path.basename(filePath).toLowerCase();
      return base.endsWith(".tf") || base.endsWith(".tf.json");
    },
    priority: 4,
    parse: (content, context) => {
      const artifact = context.artifact;
      if (!artifact) return;

      const resourceCount = (content.match(/resource\s+"/g) || []).length;
      const moduleCount = (content.match(/module\s+"/g) || []).length;

      artifact.metadata = {
        ...artifact.metadata,
        terraform: {
          resourceCount,
          moduleCount,
        },
      };
    },
  },
];

interface ParserTarget {
  parser: ParserDefinition;
  path: string;
  priority: number;
}

function collectParserTargets(files: string[]): ParserTarget[] {
  const targets: ParserTarget[] = [];
  for (const file of files) {
    for (const parser of PARSERS) {
      if (parser.matches(file)) {
        targets.push({ parser, path: file, priority: parser.priority });
      }
    }
  }
  return targets;
}
