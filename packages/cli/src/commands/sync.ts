import { syncProject } from "../services/sync/index.js";
import type { CLIConfig, SyncOptions } from "../types.js";

export async function syncCommand(options: SyncOptions, config: CLIConfig): Promise<number> {
  return syncProject(options, config);
}
