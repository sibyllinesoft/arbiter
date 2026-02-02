/**
 * @packageDocumentation
 * Handler registry for manifest sync.
 *
 * Manages built-in and custom handlers for extracting package metadata.
 */

import type { HandlerRegistry, ManifestHandler } from "./types.js";

// Built-in handlers
import { cargoTomlHandler } from "./cargo-toml.js";
import { goModHandler } from "./go-mod.js";
import { packageJsonHandler } from "./package-json.js";
import { pyprojectTomlHandler } from "./pyproject-toml.js";

/**
 * Simple pattern matching for manifest files.
 * Supports exact match and ** prefix for "any path" matching.
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  const fileName = filePath.split("/").pop() || filePath;

  // Exact filename match
  if (pattern === fileName) {
    return true;
  }

  // ** prefix means match this filename anywhere in path
  if (pattern.startsWith("**/")) {
    const targetName = pattern.slice(3);
    return fileName === targetName;
  }

  return false;
}

/**
 * Default handler registry with built-in handlers.
 */
export function createHandlerRegistry(): HandlerRegistry {
  const handlers: ManifestHandler[] = [
    packageJsonHandler,
    cargoTomlHandler,
    pyprojectTomlHandler,
    goModHandler,
  ];

  return {
    register(handler: ManifestHandler): void {
      // Check for duplicate ID
      const existing = handlers.findIndex((h) => h.id === handler.id);
      if (existing >= 0) {
        // Replace existing handler with same ID
        handlers[existing] = handler;
      } else {
        // Add new handler at the beginning (custom handlers take priority)
        handlers.unshift(handler);
      }
    },

    getHandler(filePath: string): ManifestHandler | null {
      for (const handler of handlers) {
        for (const pattern of handler.patterns) {
          if (matchesPattern(filePath, pattern)) {
            return handler;
          }
        }
      }

      return null;
    },

    getAll(): ManifestHandler[] {
      return [...handlers];
    },
  };
}

/**
 * Built-in handlers exported for testing and customization.
 */
export const builtinHandlers = {
  packageJson: packageJsonHandler,
  cargoToml: cargoTomlHandler,
  pyprojectToml: pyprojectTomlHandler,
  goMod: goModHandler,
};
