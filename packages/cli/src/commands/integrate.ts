import { integrateProject } from "../services/integrate/index.js";
import type { CLIConfig, IntegrateOptions } from "../types.js";

export async function integrateCommand(
  options: IntegrateOptions,
  config: CLIConfig,
): Promise<number> {
  return integrateProject(options, config);
}
