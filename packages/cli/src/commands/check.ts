import { runCheckCommand } from "../services/check/index.js";
import type { CLIConfig, CheckOptions } from "../types.js";

export async function checkCommand(
  patterns: string[],
  options: CheckOptions,
  config: CLIConfig,
): Promise<number> {
  return await runCheckCommand(patterns, options, config);
}
