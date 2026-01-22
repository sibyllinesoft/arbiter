/**
 * @packageDocumentation
 * Project commands module - Registers CLI commands for project management,
 * validation, and health checking.
 *
 * This module provides command registration for:
 * - `init` - Initialize new projects from presets
 * - `surface` - Extract API surface from source code
 * - `check` - Validate CUE specification files
 * - `list` - List project components by type
 * - `status` - Show project status overview
 * - `diff` - Compare CUE schema versions
 * - `health` - Server health checks
 */

import { requireCommandConfig } from "@/cli/context.js";
import { runCheckCommand } from "@/services/check/index.js";
import { diffCommand } from "@/services/diff/index.js";
import { initCommand, listPresets } from "@/services/init/index.js";
import { listCommand } from "@/services/list/index.js";
import { statusCommand } from "@/services/status/index.js";
import { surfaceCommand } from "@/services/surface/index.js";
import type { SurfaceLanguage } from "@/surface-extraction/types.js";
import type {
  CLIConfig,
  CheckOptions,
  HealthResponse,
  InitOptions,
  SurfaceOptions,
} from "@/types.js";
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
 * Register the `surface` command for API surface extraction.
 * @param program - Commander program instance
 */
function registerSurfaceCommand(program: Command): void {
  program
    .command("surface <language>")
    .description("extract API surface from source code and generate project-specific surface file")
    .option("-o, --output <file>", "explicit output file path (overrides smart naming)")
    .option("--format <format>", "output format (cue, json, yaml)", "cue")
    .option(
      "--project-name <name>",
      "project name for file naming (auto-detected if not specified)",
    )
    .option("--include-private", "include private methods and properties")
    .option("--diff", "compare against existing spec and show changes")
    .action(async (language: string, options, command) => {
      try {
        const config = requireCommandConfig(command);
        const surfaceOptions: SurfaceOptions = {
          language: language as SurfaceLanguage,
          output: options.output,
          format: options.format,
          projectName: options.projectName,
          includePrivate: options.includePrivate,
          diff: options.diff,
        };
        exitWithCode(await surfaceCommand(surfaceOptions, config));
      } catch (error) {
        handleCommandError(error);
      }
    });
}

/**
 * Register the `check` command for CUE file validation.
 * @param program - Commander program instance
 */
function registerCheckCommand(program: Command): void {
  program
    .command("check [patterns...]")
    .description("validate CUE files in the current directory")
    .option("-f, --format <format>", "output format (table, json)", "table")
    .option("-w, --watch", "watch for file changes and re-validate (deprecated)")
    .action(async (patterns: string[], options: CheckOptions, command) => {
      try {
        const config = requireCommandConfig(command);
        exitWithCode(await runCheckCommand(patterns, options, config));
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
  program
    .command("list <type>")
    .description("list components of a specific type in the project")
    .option("-f, --format <format>", "output format (table, json)", "table")
    .option("-v, --verbose", "verbose output with additional details")
    .action(async (type: string, options, command) => {
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
 * Register the `health` command for server health checking.
 * @param program - Commander program instance
 */
function registerHealthCommand(program: Command): void {
  program
    .command("health")
    .description("comprehensive Arbiter server health check")
    .option("--verbose", "show detailed health information")
    .option("--timeout <ms>", "health check timeout in milliseconds")
    .action(async (options: { verbose?: boolean; timeout?: string }, command) => {
      try {
        const config = requireCommandConfig(command);
        exitWithCode(await runHealthCheck(config, options));
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
  registerSurfaceCommand(program);
  registerCheckCommand(program);
  registerListCommand(program);
  registerStatusCommand(program);
  registerDiffCommand(program);
  registerHealthCommand(program);
}

/**
 * Log initial health check header information.
 */
function logHealthCheckHeader(apiUrl: string, timeout: number, verbose?: boolean): void {
  console.log(chalk.blue("🏥 Comprehensive health check..."));
  console.log(chalk.dim(`Server: ${apiUrl}`));
  console.log(chalk.dim(`Timeout: ${timeout}ms (client caps requests at 10s)`));

  if (verbose) {
    console.log(chalk.cyan("\n🔍 Detailed validation:"));
  }
}

/**
 * Handle healthy server response.
 */
function logHealthyServer(verbose?: boolean): void {
  console.log(chalk.green("✅ Server is healthy"));
  if (verbose) {
    console.log(chalk.dim("  - API endpoints responding"));
    console.log(chalk.dim("  - Database connections active"));
  }
}

/**
 * Handle server with issues response.
 */
function logServerIssues(healthData: HealthResponse): void {
  console.log(chalk.yellow("⚠️  Server has issues"));
  if (healthData.issues) {
    for (const issue of healthData.issues) {
      console.log(chalk.yellow(`  - ${issue}`));
    }
  }
}

/**
 * Log connection failure information.
 */
function logConnectionFailure(verbose?: boolean): void {
  console.log(chalk.red("❌ Server unreachable or not responding"));
  if (verbose) {
    console.log(chalk.dim("  Possible causes:"));
    console.log(chalk.dim("  - Server not running (run: bun run dev)"));
    console.log(chalk.dim("  - Wrong API URL in configuration"));
    console.log(chalk.dim("  - Network connectivity issues"));
  }
}

/**
 * Perform a comprehensive health check against the Arbiter server.
 *
 * @param config - CLI configuration containing API URL and timeout
 * @param options - Health check options (verbose mode, custom timeout)
 * @returns Exit code (0 for healthy, 1 for unreachable/unhealthy)
 */
async function runHealthCheck(
  config: CLIConfig,
  options: { verbose?: boolean; timeout?: string },
): Promise<number> {
  const { ApiClient } = await import("@/io/api/api-client.js");
  const { SystemRepository } = await import("@/repositories/system-repository.js");
  const apiClient = new ApiClient(config);
  const systemRepo = new SystemRepository(apiClient);
  const timeout = options.timeout ? Number.parseInt(options.timeout, 10) : config.timeout;

  logHealthCheckHeader(config.apiUrl, timeout, options.verbose);

  try {
    const health = await systemRepo.health();
    const healthData = health.data as HealthResponse;

    if (health.data.status === "healthy") {
      logHealthyServer(options.verbose);
    } else {
      logServerIssues(healthData);
    }

    if (options.verbose) {
      const validationResult = await apiClient.validate('test: "hello"');
      console.log(
        validationResult.data.valid
          ? chalk.green("  ✅ CUE validation working")
          : chalk.red("  ❌ CUE validation failed"),
      );
    }

    return 0;
  } catch {
    logConnectionFailure(options.verbose);
    return 1;
  }
}
