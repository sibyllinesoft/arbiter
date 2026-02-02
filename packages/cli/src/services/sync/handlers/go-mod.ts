/**
 * @packageDocumentation
 * Handler for go.mod manifest files (Go).
 */

import path from "node:path";
import type { ExtractedPackage, ManifestHandler } from "./types.js";

/**
 * Parse go.mod file - extracts module name and dependencies.
 */
function parseGoMod(content: string): { module: string; goVersion?: string; deps: string[] } {
  const lines = content.split("\n");
  let module = "";
  let goVersion: string | undefined;
  const deps: string[] = [];
  let inRequireBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith("//") || !trimmed) continue;

    // Module declaration
    const moduleMatch = trimmed.match(/^module\s+(\S+)/);
    if (moduleMatch) {
      module = moduleMatch[1];
      continue;
    }

    // Go version
    const goMatch = trimmed.match(/^go\s+(\S+)/);
    if (goMatch) {
      goVersion = goMatch[1];
      continue;
    }

    // Start of require block
    if (trimmed === "require (") {
      inRequireBlock = true;
      continue;
    }

    // End of require block
    if (trimmed === ")") {
      inRequireBlock = false;
      continue;
    }

    // Single-line require
    const singleRequireMatch = trimmed.match(/^require\s+(\S+)\s+/);
    if (singleRequireMatch) {
      deps.push(singleRequireMatch[1]);
      continue;
    }

    // Dependency in require block
    if (inRequireBlock) {
      const depMatch = trimmed.match(/^(\S+)\s+/);
      if (depMatch && !depMatch[1].startsWith("//")) {
        deps.push(depMatch[1]);
      }
    }
  }

  return { module, goVersion, deps };
}

/**
 * Extract package name from Go module path.
 * github.com/user/repo -> repo
 * github.com/user/repo/v2 -> repo
 */
function extractNameFromModule(modulePath: string): string {
  // Remove version suffix
  const withoutVersion = modulePath.replace(/\/v\d+$/, "");
  // Get last path segment
  const parts = withoutVersion.split("/");
  return parts[parts.length - 1];
}

export const goModHandler: ManifestHandler = {
  id: "go-mod",
  name: "go.mod",
  patterns: ["go.mod", "**/go.mod"],

  async extract(filePath, content, projectRoot): Promise<ExtractedPackage | null> {
    const { module, deps } = parseGoMod(content);

    if (!module) {
      return null;
    }

    const extracted: ExtractedPackage = {
      name: extractNameFromModule(module),
      language: "go",
      manifest: path.relative(projectRoot, filePath),
      directory: path.relative(projectRoot, path.dirname(filePath)) || ".",
      dependencies: deps.length > 0 ? deps : undefined,
      // Go doesn't have a standard repository field in go.mod,
      // but the module path often IS the repository
      repository: module.startsWith("github.com") ? `https://${module}` : undefined,
    };

    return extracted;
  },
};
