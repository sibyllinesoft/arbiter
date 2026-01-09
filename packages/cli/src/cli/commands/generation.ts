/**
 * @packageDocumentation
 * Generation commands module - Registers CLI commands for code generation,
 * documentation, and project explanation.
 *
 * This module provides:
 * - `generate` - Generate project files from CUE specifications
 * - `explain` - Generate human-readable summaries of project specs
 */

import { requireCommandConfig } from "@/cli/context.js";
import { loadConfigWithGitDetection } from "@/io/config/config.js";
import { explainCommand } from "@/services/explain/index.js";
import { generateCommand as runGenerateCommand } from "@/services/generate/io/index.js";
import type { GenerationReporter } from "@/services/generate/util/types.js";
import type { CLIConfig, GenerateOptions } from "@/types.js";
import chalk from "chalk";
import { Command } from "commander";

/**
 * Handle command errors by logging and exiting with error code 2.
 * @param error - The error that occurred
 */
function handleCommandError(error: unknown): never {
  console.error(
    chalk.red("Command failed:"),
    error instanceof Error ? error.message : String(error),
  );
  process.exit(2);
}

/**
 * Create a function that formats string arguments.
 * @param format - The format function to apply
 * @returns Function that applies format to string arguments
 */
function formatArg(format: (s: string) => string) {
  return (arg: unknown) => (typeof arg === "string" ? format(arg) : arg);
}

/**
 * Create a generation reporter with optional color support.
 * @param options - Generate options containing color preference
 * @returns Reporter object with info, warn, and error methods
 */
function createReporter(options: GenerateOptions): GenerationReporter {
  const colorEnabled = options.color ?? true;
  const format = colorEnabled ? (msg: string) => msg : (msg: string) => chalk.reset(msg);
  const formatArgs = formatArg(format);

  return {
    info: (...args: unknown[]) => console.log(...args.map(formatArgs)),
    warn: (...args: unknown[]) => console.warn(...args.map(formatArgs)),
    error: (...args: unknown[]) => console.error(...args.map(formatArgs)),
  };
}

/**
 * Handle the generate command execution.
 * @param specName - Optional specification name to generate
 * @param options - Generation options
 * @param command - Commander command instance
 */
async function handleGenerateCommand(
  specName: string | undefined,
  options: GenerateOptions,
  command: Command,
): Promise<void> {
  try {
    const parentConfig = requireCommandConfig(command);
    const configWithGit = await loadConfigWithGitDetection(parentConfig);
    const reporter = createReporter(options);
    const exitCode = await runGenerateCommand({ ...options, reporter }, configWithGit, specName);
    process.exit(exitCode);
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Handle the explain command execution.
 * @param options - Explain options (output file, format, verbose)
 * @param command - Commander command instance
 */
async function handleExplainCommand(
  options: { output?: string; format?: string; verbose?: boolean },
  command: Command,
): Promise<void> {
  try {
    const config = requireCommandConfig(command);
    const exitCode = await explainCommand(options, config);
    process.exit(exitCode);
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Register generation-related commands on the given program.
 * This is the main entry point for generation command setup.
 *
 * @param program - The Commander program instance
 */
export function createGenerationCommands(program: Command): void {
  program
    .command("generate [spec-name]")
    .description("generate project files from stored specifications")
    .option(
      "--project-dir <dir>",
      "project directory to sync generated artifacts into (defaults to current working directory or config.projectDir)",
    )
    .option("--spec <name>", "use a specific stored specification")
    .option("--force", "overwrite existing files despite validation warnings")
    .option("--dry-run", "preview what would be generated without creating files")
    .option("--sync-github", "sync generated groups and tasks to GitHub")
    .option("--github-dry-run", "preview GitHub sync changes without applying them")
    .option("--verbose", "enable verbose logging for generation flow")
    .option("--no-color", "disable colorized output")
    .option("--no-tests", "skip test generation")
    .option("--no-docs", "skip documentation generation")
    .option("--no-code", "skip code generation (services, clients, modules)")
    .action(handleGenerateCommand);

  program
    .command("explain")
    .description("generate plain-English summary of project specifications")
    .option("--output <file>", "output file path (default: stdout)")
    .option("--format <format>", "output format (markdown, text)", "markdown")
    .option("--verbose", "detailed explanation with all configuration details")
    .action(handleExplainCommand);
}
