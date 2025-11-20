/**
 * Version commands module - Semver-aware version planning and release management
 */

import chalk from "chalk";
import { Command } from "commander";
import { versionPlanCommand, versionReleaseCommand } from "../services/version/index.js";
import type { VersionPlanOptions, VersionReleaseOptions } from "../types.js";

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
    .action(async (options: VersionPlanOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await versionPlanCommand(options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  versionCmd
    .command("release")
    .description("execute planned version release")
    .option("--version <version>", "specific version to set (overrides plan)")
    .option("--tag", "create git tag for release")
    .option("--dry-run", "preview changes without applying them (default)", true)
    .option("--apply", "apply changes (overrides dry-run)")
    .action(async (options: VersionReleaseOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await versionReleaseCommand(options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });
}
