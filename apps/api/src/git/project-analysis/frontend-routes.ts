/**
 * @module project-analysis/frontend-routes
 * Frontend route analysis and enrichment utilities.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { ROUTE_HINT_PATTERN } from "../../parsers/helpers";
import type { AnalyzedArtifact } from "../project-analysis.types";
import { extractNextRoutes, normalizeRelativePath } from "./next-routes";
import { extractReactRouterRoutes } from "./react-router-parser";
import type { FrontendRouteInfo } from "./types";

const FRONTEND_FILE_IGNORE_PATTERNS = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)tests?(\/|$)/,
  /\.stories\.[tj]sx?$/,
  /(^|\/)stories?(\/|$)/,
  /(^|\/)storybook(\/|$)/,
  /(^|\/)test-results(\/|$)/,
  /(^|\/)dist(\/|$)/,
];

/**
 * Checks if a frontend file should be ignored.
 */
function shouldIgnoreFrontendFile(relativePath: string): boolean {
  return FRONTEND_FILE_IGNORE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

/**
 * Reads and parses a package.json manifest.
 */
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

/**
 * Collects all dependencies from a package.json.
 */
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

/**
 * Detects frontend frameworks from package.json dependencies.
 */
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

/**
 * Checks if an artifact represents a frontend package.
 */
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

/**
 * Deduplicates routes by path and file.
 */
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

/**
 * Builds a hierarchical route tree from routes.
 */
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

/**
 * Annotates artifacts with frontend route information.
 */
export async function annotateFrontendRoutes(
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
