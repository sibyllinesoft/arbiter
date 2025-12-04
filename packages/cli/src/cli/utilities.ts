/**
 * Utilities commands module - Import, testing, and other utility commands
 */

import { importCommand } from "@/services/import/index.js";
import { testCommand } from "@/services/test/index.js";
import { coverCommand, scaffoldCommand } from "@/services/tests/index.js";
import chalk from "chalk";
import { Command } from "commander";

export function createUtilitiesCommands(program: Command): void {
  // Import command
  const importCmd = program
    .command("import")
    .description("manage trusted import registry for CUE files");

  importCmd
    .command("validate <files...>")
    .description("validate imports in CUE files against registry")
    .option("-g, --global", "use global registry")
    .action(async (files: string[], options: { global?: boolean }, _command) => {
      try {
        const importOptions = {
          global: options.global,
          files,
        };

        const exitCode = await importCommand("validate", undefined, importOptions);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  // Tests command
  const testsCmd = program
    .command("tests")
    .description("test management, scaffolding, and coverage analysis");

  testsCmd
    .command("scaffold")
    .description("generate test scaffolding from CUE specifications")
    .option("--output <dir>", "output directory for test files", "@/cli/tests")
    .option("--format <format>", "test format (jest, vitest, pytest)", "jest")
    .option("--include-integration", "include integration test templates")
    .option("--include-e2e", "include end-to-end test templates")
    .option("--migration", "generate migration guide for breaking changes")
    .option("--epic <epic>", "epic file containing test configuration")
    .option("--force", "overwrite existing test files")
    .action(async (options, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await scaffoldCommand(options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  testsCmd
    .command("cover")
    .description("analyze test coverage and generate reports")
    .option("--threshold <percentage>", "minimum coverage threshold", "80")
    .option("--format <format>", "report format (lcov, json, text)", "text")
    .option("--output <file>", "output file for coverage report")
    .option("--include-branches", "include branch coverage analysis")
    .option("--framework <name>", "test framework override")
    .action(async (options, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const testsOptions = {
          threshold: options.threshold ? Number.parseInt(options.threshold, 10) : 80,
          format: options.format,
          output: options.output,
          includeBranches: options.includeBranches,
          framework: options.framework,
        };

        const exitCode = await coverCommand(testsOptions, config);
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
