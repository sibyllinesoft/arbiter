/**
 * @packageDocumentation
 * Tooling commands for validation, docs, tests, examples, watch, and release workflows.
 */

import { requireCommandConfig } from "@/cli/context.js";
import { runCheckCommand } from "@/services/check/index.js";
import { docsCommand } from "@/services/docs/index.js";
import { examplesCommand } from "@/services/examples/index.js";
import { testCommand } from "@/services/test/index.js";
import { coverCommand, scaffoldCommand } from "@/services/tests/index.js";
import { watchCommand } from "@/services/watch/index.js";
import chalk from "chalk";
import { Command } from "commander";
import { createVersionCommands } from "./version.js";

function handleCommandError(error: unknown): never {
  console.error(
    chalk.red("Command failed:"),
    error instanceof Error ? error.message : String(error),
  );
  process.exit(2);
}

export function createToolingCommands(program: Command): void {
  program
    .command("check [patterns...]")
    .description("validate Arbiter project files")
    .option("-r, --recursive", "search recursively for matching files", true)
    .option("-w, --watch", "watch for file changes and re-run validation")
    .option("-f, --format <format>", "output format (table, json)", "table")
    .option("--fail-fast", "stop after the first failure")
    .option("-v, --verbose", "show verbose output")
    .action(async (patterns: string[] = [], options, command) => {
      try {
        const config = requireCommandConfig(command);
        const exitCode = await runCheckCommand(patterns, options, config);
        process.exit(exitCode);
      } catch (error) {
        handleCommandError(error);
      }
    });

  program
    .command("docs <subcommand>")
    .description("generate documentation from the markdown-first Arbiter vault")
    .option("--format <type>", "output format (markdown, html, json)", "markdown")
    .option("--output <file>", "output file path")
    .option("--output-dir <dir>", "output directory")
    .option("--template <name>", "template preset to use")
    .option("--interactive", "run interactive documentation setup")
    .option("--examples", "generate example files alongside documentation")
    .action(async (subcommand: "schema" | "api" | "help", options, command) => {
      try {
        const config = requireCommandConfig(command);
        const exitCode = await docsCommand(subcommand, options, config);
        process.exit(exitCode);
      } catch (error) {
        handleCommandError(error);
      }
    });

  program
    .command("examples <type>")
    .description("generate example Arbiter projects")
    .option("--profile <name>", "filter by example profile")
    .option("--language <name>", "filter by language")
    .option("--output <dir>", "output directory")
    .option("--minimal", "generate a minimal example")
    .option("--complete", "generate a complete example")
    .action(async (type: string, options, command) => {
      try {
        const config = requireCommandConfig(command);
        const exitCode = await examplesCommand(type, options, config);
        process.exit(exitCode);
      } catch (error) {
        handleCommandError(error);
      }
    });

  program
    .command("watch")
    .description("watch the project for changes and re-run validations")
    .option("--path <path>", "path to watch")
    .option("--debounce <ms>", "debounce interval in milliseconds", (value) => parseInt(value, 10))
    .option("--patterns <patterns>", "comma-separated file patterns to watch")
    .option("--validate", "run validation on changes")
    .option("--plan", "rebuild planning artifacts on changes")
    .action(async (options, command) => {
      try {
        const config = requireCommandConfig(command);
        const normalized = {
          ...options,
          patterns:
            typeof options.patterns === "string"
              ? options.patterns
                  .split(",")
                  .map((value: string) => value.trim())
                  .filter(Boolean)
              : undefined,
        };
        const exitCode = await watchCommand(normalized, config);
        process.exit(exitCode);
      } catch (error) {
        handleCommandError(error);
      }
    });

  program
    .command("test")
    .description("run the Arbiter test harness")
    .option("--group <name>", "run a named test group")
    .option("--types <types>", "comma-separated test types to run")
    .option("--junit <file>", "write JUnit output")
    .option("--timeout <ms>", "per-suite timeout in milliseconds", (value) => parseInt(value, 10))
    .option("--parallel", "run suites in parallel where supported")
    .option("--update-golden", "update golden snapshots")
    .option("-v, --verbose", "show verbose output")
    .action(async (options) => {
      try {
        const normalized = {
          ...options,
          types:
            typeof options.types === "string"
              ? options.types
                  .split(",")
                  .map((value: string) => value.trim())
                  .filter(Boolean)
              : undefined,
        };
        const exitCode = await testCommand(normalized);
        process.exit(exitCode);
      } catch (error) {
        handleCommandError(error);
      }
    });

  const testsCmd = program
    .command("tests")
    .description("scaffold, run, and measure invariant-driven tests");

  testsCmd
    .command("run")
    .description("run the Arbiter test harness")
    .option("--group <name>", "run a named test group")
    .option("--types <types>", "comma-separated test types to run")
    .option("--junit <file>", "write JUnit output")
    .option("--timeout <ms>", "per-suite timeout in milliseconds", (value) => parseInt(value, 10))
    .option("--parallel", "run suites in parallel where supported")
    .option("--update-golden", "update golden snapshots")
    .option("-v, --verbose", "show verbose output")
    .action(async (options) => {
      try {
        const normalized = {
          ...options,
          types:
            typeof options.types === "string"
              ? options.types
                  .split(",")
                  .map((value: string) => value.trim())
                  .filter(Boolean)
              : undefined,
        };
        const exitCode = await testCommand(normalized);
        process.exit(exitCode);
      } catch (error) {
        handleCommandError(error);
      }
    });

  testsCmd
    .command("scaffold")
    .description("generate test scaffolding from discovered invariants")
    .option("--language <lang>", "target language (typescript, python, rust, go, bash)")
    .option("--framework <name>", "test framework")
    .option("--property", "generate property-based tests where possible")
    .option("--output <dir>", "output directory")
    .option("--force", "overwrite existing files")
    .option("-v, --verbose", "show verbose output")
    .action(async (options, command) => {
      try {
        const config = requireCommandConfig(command);
        const exitCode = await scaffoldCommand(options, config);
        process.exit(exitCode);
      } catch (error) {
        handleCommandError(error);
      }
    });

  testsCmd
    .command("cover")
    .description("calculate invariant test coverage")
    .option("--language <lang>", "target language (typescript, python, rust, go, bash)")
    .option("--threshold <value>", "minimum required coverage", (value) => parseFloat(value))
    .option("--junit <file>", "write JUnit output")
    .option("-v, --verbose", "show verbose output")
    .action(async (options, command) => {
      try {
        const config = requireCommandConfig(command);
        const exitCode = await coverCommand(options, config);
        process.exit(exitCode);
      } catch (error) {
        handleCommandError(error);
      }
    });

  createVersionCommands(program);
}
