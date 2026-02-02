/**
 * Preset Loader
 *
 * Discovers and loads init presets from:
 * 1. Project-level: .arbiter/presets/
 * 2. User-level: ~/.arbiter/presets/
 * 3. Built-in: this directory
 */

import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathExists, readdir } from "fs-extra";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Get search paths for presets (project → user → builtin)
 */
export function getPresetSearchPaths(projectDir) {
  const paths = [];

  // Project-level presets
  if (projectDir) {
    paths.push(join(projectDir, ".arbiter", "presets"));
  }

  // User-level presets
  paths.push(join(homedir(), ".arbiter", "presets"));

  // Built-in presets
  paths.push(__dirname);

  return paths;
}

/**
 * List all available presets
 */
export async function listPresets(projectDir) {
  const presets = new Map(); // Use Map to handle overrides (first found wins)
  const searchPaths = getPresetSearchPaths(projectDir);

  for (const basePath of searchPaths) {
    if (!(await pathExists(basePath))) continue;

    try {
      const entries = await readdir(basePath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
        if (entry.name === "loader.js") continue;

        // Check if module.js exists
        const modulePath = join(basePath, entry.name, "module.js");
        if (!(await pathExists(modulePath))) continue;

        // Only add if not already found (project overrides user overrides builtin)
        if (!presets.has(entry.name)) {
          try {
            const mod = await import(modulePath);
            presets.set(entry.name, {
              id: mod.id || entry.name,
              name: mod.name || entry.name,
              description: mod.description || "",
              language: mod.language,
              category: mod.category,
              path: modulePath,
              source:
                basePath === __dirname
                  ? "builtin"
                  : basePath.includes(".arbiter/presets")
                    ? "project"
                    : "user",
            });
          } catch (err) {
            console.warn(`Warning: Failed to load preset ${entry.name}: ${err.message}`);
          }
        }
      }
    } catch {
      // Directory not readable
    }
  }

  return Array.from(presets.values());
}

/**
 * Load a preset module by ID
 */
export async function loadPreset(presetId, projectDir) {
  const searchPaths = getPresetSearchPaths(projectDir);

  for (const basePath of searchPaths) {
    const modulePath = join(basePath, presetId, "module.js");

    if (await pathExists(modulePath)) {
      return import(modulePath);
    }
  }

  throw new Error(`Preset not found: ${presetId}`);
}

/**
 * Execute a preset with the given context
 */
export async function executePreset(presetId, context, projectDir) {
  const mod = await loadPreset(presetId, projectDir);

  if (typeof mod.default !== "function") {
    throw new Error(`Preset ${presetId} does not export a default function`);
  }

  return mod.default(context);
}

export default {
  getPresetSearchPaths,
  listPresets,
  loadPreset,
  executePreset,
};
