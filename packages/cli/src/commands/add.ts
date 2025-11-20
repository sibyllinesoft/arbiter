import type { AddOptions } from "../services/add/index.js";
import { runAddCommand } from "../services/add/index.js";
import type { CLIConfig } from "../types.js";

export type { AddOptions } from "../services/add/index.js";

export async function addCommand(
  subcommand: string,
  name: string,
  options: AddOptions & Record<string, any>,
  config: CLIConfig,
): Promise<number> {
  return await runAddCommand(subcommand, name, options, config);
}
