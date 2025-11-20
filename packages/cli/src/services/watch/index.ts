import type { CLIConfig, WatchOptions } from "../../types.js";

/**
 * TODO: Restore watch implementation. Placeholder returns success.
 */
export async function watchCommand(_options: WatchOptions, _config: CLIConfig): Promise<number> {
  console.warn("Watch command is currently not implemented; exiting.");
  return 0;
}
