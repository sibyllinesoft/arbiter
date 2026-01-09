/**
 * @packageDocumentation
 * Arbiter CLI entry points for programmatic usage.
 *
 * This module re-exports the primary command program and supporting utilities
 * so that downstream tooling can integrate the CLI without shelling out.
 */

export * from "@/io/api/api-client.js";
// Main CLI program for programmatic use
export { default as program } from "@/cli/index.js";
// Commands
export { runCheckCommand as checkCommand } from "@/services/check/index.js";
export { initCommand, listPresets } from "@/services/init/index.js";
export * from "@/io/config/config.js";
export * from "@/types.js";
// Utilities
export * from "@/utils/util/output/formatting.js";
export * from "@/utils/api/progress.js";
