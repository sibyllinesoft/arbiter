import { generateCommand as runGenerateCommand } from "../services/generate/index.js";
import type { GenerateOptions } from "../services/generate/types.js";
import type { CLIConfig } from "../types.js";

export type { GenerateOptions } from "../services/generate/types.js";

/**
 * Thin command shim that delegates to the new GenerateService implementation.
 */
export async function generateCommand(
  options: GenerateOptions,
  config: CLIConfig,
  specName?: string,
): Promise<number> {
  return runGenerateCommand(options, config, specName);
}
