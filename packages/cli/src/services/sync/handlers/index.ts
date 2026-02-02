/**
 * @packageDocumentation
 * Pluggable manifest handlers for sync.
 */

export * from "./types.js";
export * from "./registry.js";
export { packageJsonHandler } from "./package-json.js";
export { cargoTomlHandler } from "./cargo-toml.js";
export { pyprojectTomlHandler } from "./pyproject-toml.js";
export { goModHandler } from "./go-mod.js";
