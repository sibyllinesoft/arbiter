/**
 * @packageDocumentation
 * Core sync extraction logic.
 *
 * Discovers manifest files and extracts 100% reliable metadata.
 * Agents fill in the blanks (subtype, framework detection, etc.) after extraction.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import { createHandlerRegistry } from "./handlers/registry.js";
import type {
  ExtractedPackage,
  HandlerRegistry,
  ManifestSyncResult,
  SyncReport,
} from "./handlers/types.js";

/**
 * Options for manifest extraction.
 */
export interface ExtractOptions {
  /** Project root directory */
  projectRoot: string;
  /** Custom handler registry (uses defaults if not provided) */
  registry?: HandlerRegistry;
  /** Directories to ignore */
  ignore?: string[];
  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Default directories to ignore during manifest discovery.
 */
const DEFAULT_IGNORE = [
  "**/node_modules/**",
  "**/target/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/__pycache__/**",
  "**/.venv/**",
  "**/venv/**",
  "**/vendor/**",
];

/**
 * Manifest file patterns to search for.
 */
const MANIFEST_PATTERNS = [
  "package.json",
  "**/package.json",
  "Cargo.toml",
  "**/Cargo.toml",
  "pyproject.toml",
  "**/pyproject.toml",
  "go.mod",
  "**/go.mod",
];

/**
 * Discover all manifest files in the project.
 */
async function discoverManifests(projectRoot: string, ignore: string[]): Promise<string[]> {
  const allFiles: string[] = [];

  for (const pattern of MANIFEST_PATTERNS) {
    const matches = await glob(pattern, {
      cwd: projectRoot,
      ignore,
      absolute: true,
      nodir: true,
    });
    allFiles.push(...matches);
  }

  // Deduplicate
  return [...new Set(allFiles)];
}

/**
 * Extract package metadata from all discovered manifests.
 *
 * @param options - Extraction options
 * @returns Sync report with extracted packages and processing results
 */
export async function extractPackages(options: ExtractOptions): Promise<SyncReport> {
  const { projectRoot, verbose = false } = options;
  const registry = options.registry || createHandlerRegistry();
  const ignore = options.ignore || DEFAULT_IGNORE;

  // Discover manifests
  const manifestPaths = await discoverManifests(projectRoot, ignore);

  if (verbose) {
    console.log(`Found ${manifestPaths.length} manifest file(s)`);
  }

  const packages: ExtractedPackage[] = [];
  const processed: ManifestSyncResult[] = [];
  const unhandled: string[] = [];

  // Process each manifest
  for (const manifestPath of manifestPaths) {
    const handler = registry.getHandler(manifestPath);

    if (!handler) {
      unhandled.push(path.relative(projectRoot, manifestPath));
      continue;
    }

    try {
      const content = await fs.readFile(manifestPath, "utf-8");
      const extracted = await handler.extract(manifestPath, content, projectRoot);

      processed.push({
        manifest: path.relative(projectRoot, manifestPath),
        handlerId: handler.id,
        extracted,
        success: true,
      });

      if (extracted) {
        packages.push(extracted);
        if (verbose) {
          console.log(`  ✓ ${extracted.name} (${handler.name})`);
        }
      }
    } catch (error) {
      processed.push({
        manifest: path.relative(projectRoot, manifestPath),
        handlerId: handler.id,
        extracted: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      if (verbose) {
        console.log(`  ✗ ${manifestPath}: ${error}`);
      }
    }
  }

  return {
    packages,
    processed,
    unhandled,
    totalFound: manifestPaths.length,
  };
}

/**
 * Convert extracted packages to a format suitable for CUE/spec output.
 * This is the 100% reliable data - agents can enrich it further.
 */
export function toSpecPackages(packages: ExtractedPackage[]): Record<string, any> {
  const result: Record<string, any> = {};

  for (const pkg of packages) {
    // Use directory as key for uniqueness (handles monorepos)
    const key = pkg.directory === "." ? pkg.name : `${pkg.directory.replace(/\//g, "-")}`;

    result[key] = {
      name: pkg.name,
      language: pkg.language,
      manifest: pkg.manifest,
      ...(pkg.version && { version: pkg.version }),
      ...(pkg.workspaces && { workspaces: pkg.workspaces }),
      ...(pkg.repository && { repository: pkg.repository }),
      ...(pkg.license && { license: pkg.license }),
      // Dependencies stored for agent analysis but not required
      ...(pkg.dependencies && { _dependencies: pkg.dependencies }),
      ...(pkg.devDependencies && { _devDependencies: pkg.devDependencies }),
    };
  }

  return result;
}
