/**
 * @packageDocumentation
 * Handler for pyproject.toml manifest files (Python).
 */

import path from "node:path";
import type { ExtractedPackage, ManifestHandler } from "./types.js";

/**
 * Simple TOML parser for pyproject.toml - extracts only what we need.
 * Handles basic TOML patterns common in Python projects.
 */
function parsePyprojectToml(content: string): any {
  const result: any = {};
  let currentSection = "";
  let inArray = false;
  let arrayKey = "";
  let arrayItems: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith("#") || !trimmed) continue;

    // Handle multi-line arrays
    if (inArray) {
      if (trimmed === "]") {
        // End of array
        const parts = currentSection ? currentSection.split(".") : [];
        let obj = result;
        for (const part of parts) {
          obj[part] = obj[part] || {};
          obj = obj[part];
        }
        obj[arrayKey] = arrayItems;
        inArray = false;
        arrayItems = [];
        continue;
      }
      // Array item
      const itemMatch = trimmed.match(/^["']([^"']+)["'],?$/);
      if (itemMatch) {
        arrayItems.push(itemMatch[1]);
      }
      continue;
    }

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

      // Check for start of multi-line array
      if (rawValue === "[") {
        inArray = true;
        arrayKey = key;
        arrayItems = [];
        continue;
      }

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
      } else if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
        // Inline array
        const items = rawValue.slice(1, -1).split(",");
        value = items
          .map((item) => {
            const t = item.trim();
            if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
              return t.slice(1, -1);
            }
            return t;
          })
          .filter(Boolean);
      }

      // Set in appropriate section
      if (currentSection) {
        const parts = currentSection.split(".");
        let obj = result;
        for (const part of parts) {
          obj[part] = obj[part] || {};
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
 * Extract dependency names from various Python dependency formats.
 */
function extractPythonDeps(deps: any): string[] | undefined {
  if (!deps) return undefined;

  if (Array.isArray(deps)) {
    // PEP 621 style: ["requests>=2.0", "click"]
    return deps.map((dep: string) => {
      // Extract package name before version specifier
      const match = dep.match(/^([a-zA-Z0-9_-]+)/);
      return match ? match[1] : dep;
    });
  }

  if (typeof deps === "object") {
    // Poetry style: { requests = "^2.0", click = "^8.0" }
    return Object.keys(deps);
  }

  return undefined;
}

/**
 * Extract scripts/entry points.
 */
function extractScripts(pyproject: any): Record<string, string> | undefined {
  // PEP 621 scripts
  const pep621Scripts = pyproject.project?.scripts;
  // Poetry scripts
  const poetryScripts = pyproject.tool?.poetry?.scripts;

  const scripts = { ...pep621Scripts, ...poetryScripts };
  return Object.keys(scripts).length > 0 ? scripts : undefined;
}

export const pyprojectTomlHandler: ManifestHandler = {
  id: "pyproject-toml",
  name: "pyproject.toml",
  patterns: ["pyproject.toml", "**/pyproject.toml"],

  async extract(filePath, content, projectRoot): Promise<ExtractedPackage | null> {
    const pyproject = parsePyprojectToml(content);

    // Get name from PEP 621 or Poetry
    const name = pyproject.project?.name || pyproject.tool?.poetry?.name;

    if (!name) {
      return null;
    }

    // Get version
    const version = pyproject.project?.version || pyproject.tool?.poetry?.version;

    // Get dependencies from various locations
    const pep621Deps = pyproject.project?.dependencies;
    const poetryDeps = pyproject.tool?.poetry?.dependencies;
    const deps = extractPythonDeps(pep621Deps) || extractPythonDeps(poetryDeps);

    // Get dev dependencies
    const pep621DevDeps = pyproject.project?.["optional-dependencies"]?.dev;
    const poetryDevDeps = pyproject.tool?.poetry?.["dev-dependencies"];
    const devDeps = extractPythonDeps(pep621DevDeps) || extractPythonDeps(poetryDevDeps);

    // Get repository
    const repository =
      pyproject.project?.urls?.repository ||
      pyproject.project?.urls?.Repository ||
      pyproject.tool?.poetry?.repository;

    // Get license
    const license =
      typeof pyproject.project?.license === "string"
        ? pyproject.project.license
        : pyproject.project?.license?.text || pyproject.tool?.poetry?.license;

    const extracted: ExtractedPackage = {
      name,
      language: "python",
      manifest: path.relative(projectRoot, filePath),
      directory: path.relative(projectRoot, path.dirname(filePath)) || ".",
      version,
      dependencies: deps,
      devDependencies: devDeps,
      scripts: extractScripts(pyproject),
      repository,
      license,
    };

    return extracted;
  },
};
