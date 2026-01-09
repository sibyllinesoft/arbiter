/**
 * @packageDocumentation
 * Watch command - File watching with live validation (placeholder).
 *
 * Provides functionality to:
 * - Monitor CUE specification files for changes
 * - Trigger validation on file changes
 * - Display real-time validation results
 */

import type { CLIConfig, WatchOptions } from "@/types.js";

/**
 * Watch command placeholder - to be restored.
 * @param _options - Watch options
 * @param _config - CLI configuration
 * @returns Exit code (always 0 for placeholder)
 */
export async function watchCommand(_options: WatchOptions, _config: CLIConfig): Promise<number> {
  console.warn("Watch command is currently not implemented; exiting.");
  return 0;
}
