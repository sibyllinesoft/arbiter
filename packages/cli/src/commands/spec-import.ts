import { SpecImportOptions, importSpec } from "../services/spec-import/index.js";
import type { CLIConfig } from "../types.js";

export type { SpecImportOptions } from "../services/spec-import/index.js";

export async function importSpecCommand(
  filePath: string | undefined,
  options: SpecImportOptions,
  config: CLIConfig,
): Promise<number> {
  return importSpec(filePath, options, config);
}
