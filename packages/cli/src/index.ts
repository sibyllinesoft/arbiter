/**
 * @packageDocumentation
 * Arbiter CLI entry points for programmatic usage.
 *
 * This module re-exports the primary command program and supporting utilities
 * so that downstream tooling can integrate the CLI without shelling out.
 */

export * from "./api-client.js";
// Main CLI program for programmatic use
export { default as program } from "./cli/index.js";
// Commands
export { checkCommand } from "./commands/check.js";
export { initCommand, listTemplates } from "./commands/init.js";
export { importSpecCommand } from "./commands/spec-import.js";
export * from "./config.js";
export * from "./types.js";
// Utilities
export * from "./utils/formatting.js";
export * from "./utils/progress.js";
