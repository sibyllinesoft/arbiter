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
    .option("--current <file>", "current surface file path", "surface.json")
    .option("--previous <file>", "previous surface file path", "surface.prev.json")
    .option("-o, --output <file>", "write the plan to a file", "version-plan.json")
    .option("--strict", "enable strict library compliance checks")
    .option("-v, --verbose", "include verbose analysis output")
    .action(createActionHandler<VersionPlanOptions>(versionPlanCommand));

  versionCmd
    .command("release")
    .description("execute planned version release")
    .option("--plan <file>", "version plan file to execute", "version-plan.json")
    .option("--version <version>", "specific version to set (overrides plan)")
    .option("--notes <file>", "release notes output path", "RELEASE_NOTES.md")
    .option("--tests", "run release validation tests")
    .option("--dry-run", "preview changes without applying them")
    .action(createActionHandler<VersionReleaseOptions>(versionReleaseCommand));
}
