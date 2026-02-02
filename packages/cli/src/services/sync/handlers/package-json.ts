/**
 * @packageDocumentation
 * Handler for package.json manifest files.
 */

import path from "node:path";
import type { ExtractedPackage, ManifestHandler } from "./types.js";

/**
 * Detect language from package.json dependencies.
 * Returns "typescript" if typescript is a dep, otherwise "javascript".
 */
function detectLanguage(deps: Record<string, string>, devDeps: Record<string, string>): string {
  const allDeps = { ...deps, ...devDeps };
  if ("typescript" in allDeps) {
    return "typescript";
  }
  return "javascript";
}

/**
 * Extract dependency names (without versions).
 */
function extractDepNames(deps: Record<string, string> | undefined): string[] | undefined {
  if (!deps || Object.keys(deps).length === 0) return undefined;
  return Object.keys(deps);
}

/**
 * Extract entry points from package.json.
 */
function extractEntryPoints(pkg: any): Record<string, string> | undefined {
  const entries: Record<string, string> = {};

  if (pkg.main) entries.main = pkg.main;
  if (pkg.module) entries.module = pkg.module;
  if (pkg.types) entries.types = pkg.types;
  if (pkg.bin) {
    if (typeof pkg.bin === "string") {
      entries.bin = pkg.bin;
    } else if (typeof pkg.bin === "object") {
      Object.assign(entries, pkg.bin);
    }
  }

  return Object.keys(entries).length > 0 ? entries : undefined;
}

/**
 * Extract repository URL from various formats.
 */
function extractRepository(repo: any): string | undefined {
  if (!repo) return undefined;
  if (typeof repo === "string") return repo;
  if (typeof repo === "object" && repo.url) {
    // Normalize git+https:// and git:// URLs
    return repo.url.replace(/^git\+/, "").replace(/\.git$/, "");
  }
  return undefined;
}

/**
 * Extract workspaces from package.json (supports both array and object formats).
 */
function extractWorkspaces(pkg: any): string[] | undefined {
  if (!pkg.workspaces) return undefined;
  if (Array.isArray(pkg.workspaces)) return pkg.workspaces;
  if (pkg.workspaces.packages) return pkg.workspaces.packages;
  return undefined;
}

export const packageJsonHandler: ManifestHandler = {
  id: "package-json",
  name: "package.json",
  patterns: ["package.json", "**/package.json"],

  async extract(filePath, content, projectRoot): Promise<ExtractedPackage | null> {
    let pkg: any;
    try {
      pkg = JSON.parse(content);
    } catch {
      return null; // Invalid JSON, skip
    }

    // Skip if no name (not a real package)
    if (!pkg.name) {
      return null;
    }

    // Skip private packages that are just workspace roots without real code
    // (they have workspaces but no main/bin/exports)
    const isWorkspaceRoot =
      pkg.private === true && pkg.workspaces && !pkg.main && !pkg.bin && !pkg.exports;

    // Still extract workspace roots but mark them differently via workspaces field
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};

    const extracted: ExtractedPackage = {
      name: pkg.name,
      language: detectLanguage(deps, devDeps),
      manifest: path.relative(projectRoot, filePath),
      directory: path.relative(projectRoot, path.dirname(filePath)) || ".",
      version: pkg.version,
      dependencies: extractDepNames(deps),
      devDependencies: extractDepNames(devDeps),
      entryPoints: extractEntryPoints(pkg),
      scripts: pkg.scripts && Object.keys(pkg.scripts).length > 0 ? pkg.scripts : undefined,
      workspaces: extractWorkspaces(pkg),
      repository: extractRepository(pkg.repository),
      license: pkg.license,
    };

    return extracted;
  },
};
