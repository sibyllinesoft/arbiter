/**
 * @packageDocumentation
 * Handler for Cargo.toml manifest files (Rust).
 */

import path from "node:path";
import type { ExtractedPackage, ManifestHandler } from "./types.js";

/**
 * Simple TOML parser for Cargo.toml - extracts only what we need.
 * Not a full TOML parser, just handles the common Cargo.toml patterns.
 */
function parseCargoToml(content: string): any {
  const result: any = {};
  let currentSection = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith("#") || !trimmed) continue;

    // Section header
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      // Initialize nested sections
      const parts = currentSection.split(".");
      let obj = result;
      for (const part of parts) {
        obj[part] = obj[part] || {};
        obj = obj[part];
      }
      continue;
    }

    // Key-value pair
    const kvMatch = trimmed.match(/^(\S+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const [, key, rawValue] = kvMatch;
      let value: any = rawValue;

      // Parse value
      if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
        value = rawValue.slice(1, -1);
      } else if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
        value = rawValue.slice(1, -1);
      } else if (rawValue === "true") {
        value = true;
      } else if (rawValue === "false") {
        value = false;
      } else if (/^\d+$/.test(rawValue)) {
        value = parseInt(rawValue, 10);
      }

      // Set in appropriate section
      if (currentSection) {
        const parts = currentSection.split(".");
        let obj = result;
        for (const part of parts) {
          obj = obj[part];
        }
        obj[key] = value;
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Extract dependency names from Cargo.toml dependencies section.
 */
function extractDepNames(deps: Record<string, any> | undefined): string[] | undefined {
  if (!deps || Object.keys(deps).length === 0) return undefined;
  return Object.keys(deps);
}

/**
 * Extract binary targets from Cargo.toml.
 */
function extractBinaries(cargo: any): Record<string, string> | undefined {
  const entries: Record<string, string> = {};

  // Default binary from package name
  if (cargo.package?.name && !cargo.lib) {
    // Only add if there's likely a main.rs
    entries.default = "src/main.rs";
  }

  // Explicit [[bin]] entries would need array parsing, which our simple parser doesn't handle
  // For now, just return the default

  return Object.keys(entries).length > 0 ? entries : undefined;
}

export const cargoTomlHandler: ManifestHandler = {
  id: "cargo-toml",
  name: "Cargo.toml",
  patterns: ["Cargo.toml", "**/Cargo.toml"],

  async extract(filePath, content, projectRoot): Promise<ExtractedPackage | null> {
    const cargo = parseCargoToml(content);

    // Skip if no package name (workspace root without package)
    if (!cargo.package?.name) {
      // Could be a workspace root - check for workspace members
      if (cargo.workspace?.members) {
        // Return minimal info for workspace root
        return {
          name: path.basename(path.dirname(filePath)),
          language: "rust",
          manifest: path.relative(projectRoot, filePath),
          directory: path.relative(projectRoot, path.dirname(filePath)) || ".",
          workspaces: cargo.workspace.members,
        };
      }
      return null;
    }

    const extracted: ExtractedPackage = {
      name: cargo.package.name,
      language: "rust",
      manifest: path.relative(projectRoot, filePath),
      directory: path.relative(projectRoot, path.dirname(filePath)) || ".",
      version: cargo.package.version,
      dependencies: extractDepNames(cargo.dependencies),
      devDependencies: extractDepNames(cargo["dev-dependencies"]),
      entryPoints: extractBinaries(cargo),
      repository: cargo.package.repository,
      license: cargo.package.license,
    };

    return extracted;
  },
};
