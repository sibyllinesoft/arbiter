/**
 * @packageDocumentation
 * Project commands module - Registers CLI commands for project management.
 *
 * This module provides command registration for:
 * - `init` - Initialize new projects from presets
 * - `list` - List project components by type
 * - `status` - Show project status overview (includes validation)
 * - `diff` - Compare CUE schema versions
 */

import { requireCommandConfig } from "@/cli/context.js";
import { addSchemaFilterOptions } from "@/cli/schema-options.js";
import { diffCommand } from "@/services/diff/index.js";
import { initCommand, listPresets } from "@/services/init/index.js";
import { listCommand } from "@/services/list/index.js";
import { statusCommand } from "@/services/status/index.js";
import type { CLIConfig, InitOptions } from "@/types.js";
import { getAllEntitySchemas } from "@/utils/storage/schema.js";
import chalk from "chalk";
import { Command } from "commander";

/**
 * Handle command errors by logging and exiting with error code 2.
 * @param error - The error that occurred during command execution
 */
function handleCommandError(error: unknown): never {
  console.error(
    chalk.red("Command failed:"),
    error instanceof Error ? error.message : String(error),
  );
  process.exit(2);
}

/**
 * Exit the process with the specified code.
 * @param code - Exit code (0 for success, non-zero for failure)
 */
function exitWithCode(code: number): never {
  process.exit(code);
}

/**
 * Get CLI configuration with optional format override.
 * @param command - The Commander command instance
 * @param options - Options containing optional format string
 * @returns Configuration with format applied if specified
 */
function getConfigWithFormat(command: Command, options: { format?: string }): CLIConfig {
  const config = { ...requireCommandConfig(command) };
  if (typeof options.format === "string") {
    // Cast format - Commander provides string, but we validate acceptable values
    config.format = options.format as "table" | "json" | "yaml";
  }
  return config;
}

/**
 * Register the `init` command for project initialization.
 * @param program - Commander program instance
 */
function registerInitCommand(program: Command): void {
  program
    .command("init [display-name]")
    .description("initialize a new project from a preset")
    .option("--preset <id>", "preset to use (web-app, mobile-app, api-service, microservice)")
    .option("--list-presets", "list available presets")
    .action(async (displayName: string | undefined, options: InitOptions, command) => {
      try {
        if (options.listPresets) {
          listPresets();
          exitWithCode(0);
        }
        const config = requireCommandConfig(command);
        exitWithCode(await initCommand(displayName, options, config));
      } catch (error) {
        handleCommandError(error);
      }
    });
}

/**
 * Register the `list` command for listing project components.
 * @param program - Commander program instance
 */
function registerListCommand(program: Command): void {
  const listCmd = program
    .command("list <type>")
    .description("list components of a specific type in the project")
    .option("-f, --format <format>", "output format (table, json)", "table")
    .option("-v, --verbose", "verbose output with additional details");

  // Add schema-based filter options for all filterable entity types
  for (const schema of Object.values(getAllEntitySchemas())) {
    addSchemaFilterOptions(listCmd, schema);
  }

  listCmd.action(async (type: string, options, command) => {
    try {
      const config = getConfigWithFormat(command, options);
      exitWithCode(await listCommand(type, options, config));
    } catch (error) {
      handleCommandError(error);
    }
  });
}

/**
 * Register the `status` command for project status overview.
 * @param program - Commander program instance
 */
function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("show project status overview")
    .option("-f, --format <format>", "output format (table, json)", "table")
    .option("-v, --verbose", "verbose output with additional details")
    .action(async (options, command) => {
      try {
        const config = getConfigWithFormat(command, options);
        exitWithCode(await statusCommand(options, config));
      } catch (error) {
        handleCommandError(error);
      }
    });
}

/**
 * Register the `diff` command for CUE schema comparison.
 * @param program - Commander program instance
 */
function registerDiffCommand(program: Command): void {
  program
    .command("diff <old-file> <new-file>")
    .description("compare two CUE schemas and analyze changes")
    .option("-f, --format <format>", "output format (table, json)", "table")
    .option(
      "--context <lines>",
      "number of context lines",
      (value) => Number.parseInt(value, 10),
      3,
    )
    .action(async (oldFile: string, newFile: string, options) => {
      try {
        exitWithCode(await diffCommand(oldFile, newFile, options));
      } catch (error) {
        handleCommandError(error);
      }
    });
}

/**
 * Register all project-related commands on the given Commander program.
 * This is the main entry point for project command setup.
 *
 * @param program - The Commander program instance to add commands to
 */
export function createProjectCommands(program: Command): void {
  registerInitCommand(program);
  registerListCommand(program);
  registerStatusCommand(program);
  registerDiffCommand(program);
}
