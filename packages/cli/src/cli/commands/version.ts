/**
 * @packageDocumentation
 * Version commands module - Semver-aware version planning and release management.
 *
 * Provides commands for analyzing changes, planning version increments,
 * and managing release workflows.
 */

import { requireCommandConfig } from "@/cli/context.js";
import { versionPlanCommand, versionReleaseCommand } from "@/services/version/index.js";
import type { CLIConfig, VersionPlanOptions, VersionReleaseOptions } from "@/types.js";
import chalk from "chalk";
import { Command } from "commander";

/** Type alias for a command handler function that takes options and config */
type CommandHandler<T> = (options: T, config: CLIConfig) => Promise<number>;

/**
 * Create a generic action handler that wraps a command handler with config resolution.
 * @param handler - The command handler function to wrap
 * @returns Action handler function for Commander
 */
function createActionHandler<T>(handler: CommandHandler<T>) {
  return async (options: T, command: Command) => {
    try {
      const config = requireCommandConfig(command);
      const exitCode = await handler(options, config);
      process.exit(exitCode);
    } catch (error) {
      console.error(
        chalk.red("Command failed:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  };
}

/**
 * Create and register version management commands on the given program.
 * @param program - The Commander program instance
 */
export function createVersionCommands(program: Command): void {
  const versionCmd = program
    .command("version")
    .description("semver-aware version planning and release management");

  versionCmd
    .command("plan")
    .description("analyze changes and plan version increment")
    .option("-f, --format <format>", "output format (table, json)", "table")
    .option("--breaking", "force major version increment")
    .option("--feature", "force minor version increment")
    .option("--patch", "force patch version increment")
    .action(createActionHandler<VersionPlanOptions>(versionPlanCommand));

  versionCmd
    .command("release")
    .description("execute planned version release")
    .option("--version <version>", "specific version to set (overrides plan)")
    .option("--tag", "create git tag for release")
    .option("--dry-run", "preview changes without applying them (default)", true)
    .option("--apply", "apply changes (overrides dry-run)")
    .action(createActionHandler<VersionReleaseOptions>(versionReleaseCommand));
}
