import chalk from "chalk";
import type { Command } from "commander";
import { loadAuthSession } from "../auth-store.js";
import { applyEnvironmentOverrides, loadConfig } from "../config.js";
import type { CLIConfig } from "../types.js";

export interface CliContext {
  config: CLIConfig;
}

/**
 * Resolves the CLI context (configuration, auth session, environment overrides)
 * based on the root command's global options.
 */
export async function resolveCliContext(options: Record<string, any>): Promise<CliContext> {
  const config = await loadConfig(options.config);

  const cliUrl = options.arbiterUrl ?? options.apiUrl;
  if (cliUrl) config.apiUrl = cliUrl;
  if (options.timeout) config.timeout = Number.parseInt(options.timeout, 10);
  if (options.color === false) config.color = false;
  if (typeof options.local === "boolean") config.localMode = options.local;

  const finalConfig = applyEnvironmentOverrides(config);
  const authSession = await loadAuthSession();
  if (authSession) {
    finalConfig.authSession = authSession;
  } else if (finalConfig.authSession) {
    delete finalConfig.authSession;
  }

  const normalizedUrl = finalConfig.apiUrl.trim().replace(/\/+$/, "");
  finalConfig.apiUrl = normalizedUrl || finalConfig.apiUrl.trim();
  finalConfig.localMode = Boolean(finalConfig.localMode);

  return { config: finalConfig };
}

/**
 * Hydrates the current command graph with a resolved CLI context, making the
 * configuration accessible to command handlers.
 */
export async function hydrateCliContext(
  thisCommand: Command,
  actionCommand: Command,
): Promise<void> {
  const context = await resolveCliContext(thisCommand.opts());
  (thisCommand as any).config = context.config;
  (actionCommand as any).config = context.config;
}

/**
 * Traverses the command tree to retrieve the resolved configuration. Throws if
 * the configuration has not been attached (which indicates CLI bootstrap failed).
 */
export function requireCommandConfig(command: Command): CLIConfig {
  let cursor: Command | null = command;
  while (cursor) {
    const cfg = (cursor as any).config as CLIConfig | undefined;
    if (cfg) {
      return cfg;
    }
    cursor = cursor.parent ?? null;
  }

  throw new Error(
    chalk.red(
      "Configuration not loaded. Ensure the CLI preAction hook executed before invoking this command.",
    ),
  );
}
