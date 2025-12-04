import { promises as fs } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { ContentFetcher } from "./content-fetcher";
import { FetchQueue } from "./fetch-queue";
import type { ProjectStructure } from "./git-scanner.types";
import { collectParserTargets } from "./parsers";
import {
  DATABASE_HINTS,
  DOCKER_COMPOSE_FILES,
  PACKAGE_MANIFESTS,
  ROUTE_HINT_PATTERN,
  buildTsoaAnalysisFromPackage,
  classifyCargoManifest,
  classifyPackageManifest,
  collectCargoDependencyNames,
  detectNodePackageLanguage,
  extractCargoBinaryNames,
  isConfigJson,
  isInfrastructureYaml,
  makeArtifactId,
  normalizeSlashes,
  prettifyName,
} from "./parsers/helpers";
import type { AnalyzedArtifact, TreeAnalysisResult } from "./project-analysis.types";

interface StructureMetrics {
  filesScanned: number;
  usedGitLsFiles?: boolean;
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

  // Fallback: if no services detected yet but a docker-compose file is present,
  // create a placeholder service entry so downstream consumers have at least one service.
  if (!artifacts.some((a) => a.type === "service")) {
    const composeFile = files.find((file) =>
      DOCKER_COMPOSE_FILES.has(path.basename(file).toLowerCase()),
    );
    if (composeFile) {
      const id = makeArtifactId(projectId, `${composeFile}#placeholder-service`);
      artifacts.push({
        id,
        name: `${prettifyName(composeFile)}-service`,
        type: "service",
        description: "Service inferred from docker-compose presence.",
        language: null,
        framework: null,
        metadata: {
          composeFile,
          inferred: "docker-compose",
        },
        filePath: composeFile,
        links: [
          {
            type: "defined_in",
            target: composeFile,
          },
        ],
      });
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
    // Seed a package artifact so the manifest parser can enrich it
    return {
      id,
      name,
      type: "package",
      description: "Node package manifest detected.",
      language: "JavaScript",
      framework: null,
      metadata: {
        filePath,
      },
      filePath,
      links: [],
    };
  }

  if (base === "cargo.toml") {
    // Seed a Rust package artifact so the Cargo parser can classify it
    return {
      id,
      name,
      type: "package",
      description: "Rust Cargo manifest detected.",
      language: "Rust",
      framework: null,
      metadata: {
        filePath,
      },
      filePath,
      links: [],
    };
  }

  if (base === "dockerfile" || base.startsWith("dockerfile.")) {
    // Dockerfiles are infrastructure, not services
    // Include parent directory in name for disambiguation
    const parentDir = path.basename(path.dirname(filePath));
    const dockerfileSuffix = base === "dockerfile" ? "" : `-${base.replace("dockerfile.", "")}`;
    const contextName = parentDir && parentDir !== "." ? `${parentDir}${dockerfileSuffix}` : name;
    return {
      id,
      name: `${contextName}-container`,
      type: "infrastructure",
      description: `Dockerfile for ${contextName} containerized deployment.`,
      language: null,
      framework: null,
      metadata: {
        filePath,
        dockerfile: true,
        context: parentDir,
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
    // Include parent directories for context (e.g., "prometheus/configmap" instead of just "configmap")
    const pathParts = filePath.split(path.sep);
    const parentDir = pathParts.length > 1 ? pathParts[pathParts.length - 2] : "";
    const contextName = parentDir && parentDir !== "." ? `${parentDir}/${name}` : name;
    return {
      id,
      name: `${contextName}-k8s`,
      type: "infrastructure",
      description: `Kubernetes resource: ${contextName}.`,
      language: null,
      framework: null,
      metadata: {
        filePath,
        kubernetes: true,
        context: parentDir,
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
