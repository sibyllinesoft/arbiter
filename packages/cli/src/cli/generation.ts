/**
 * Generation commands module - Code generation, documentation, and examples
 */

import chalk from "chalk";
import { Command } from "commander";
import { docsGenerateCommand } from "../commands/docs-generate.js";
import { docsCommand } from "../commands/docs.js";
import { examplesCommand } from "../commands/examples.js";
import { executeCommand } from "../commands/execute.js";
import { explainCommand } from "../commands/explain.js";
import { generateCommand } from "../commands/generate.js";
import { renameCommand, showNamingHelp } from "../commands/rename.js";
import { loadConfigWithGitDetection } from "../config.js";
import type { GenerateOptions } from "../types.js";
import { requireCommandConfig } from "./context.js";

export function createGenerationCommands(program: Command): void {
  // Generate command (with integrated docs functionality)
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
    .option("--sync-github", "sync generated epics and tasks to GitHub")
    .option("--github-dry-run", "preview GitHub sync changes without applying them")
    .option("--verbose", "enable verbose logging for generation flow")
    .action(async (specName: string | undefined, options: GenerateOptions, command) => {
      try {
        const parentConfig = requireCommandConfig(command);
        const configWithGit = await loadConfigWithGitDetection(parentConfig);
        const exitCode = await generateCommand(options, configWithGit, specName);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  // Standalone docs command (for backward compatibility)
  const docsCmd = program
    .command("docs")
    .description("generate documentation from CUE schemas and API surfaces");

  docsCmd
    .command("schema")
    .description("generate schema documentation from project specifications")
    .option("--output <dir>", "documentation output directory", "./docs")
    .option("--format <format>", "output format (markdown, html)", "markdown")
    .option("--include-examples", "generate example files alongside documentation")
    .action(async (options, command) => {
      try {
        const config = requireCommandConfig(command);
        const exitCode = await docsCommand("schema", options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  docsCmd
    .command("api")
    .description("generate API documentation from specifications")
    .option("--output <dir>", "documentation output directory", "./docs")
    .option("--format <format>", "output format (openapi, markdown)", "openapi")
    .option("--include-examples", "include request/response examples")
    .action(async (options, command) => {
      try {
        const config = requireCommandConfig(command);
        const exitCode = await docsCommand("api", options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  docsCmd
    .command("cli")
    .description("generate comprehensive CLI reference documentation")
    .option("--output <dir>", "documentation output directory", "./docs")
    .option("--formats <formats>", "output formats (markdown,html,json)", "markdown")
    .option("--include-examples", "include usage examples")
    .option("--include-internal", "include internal/hidden commands")
    .option("--toc", "include table of contents", true)
    .option("--search", "include search functionality (HTML only)", true)
    .option("--validate", "validate documentation completeness")
    .option("--watch", "watch mode for development")
    .option("--dry-run", "preview what would be generated")
    .option("--verbose", "verbose output")
    .action(async (options, command) => {
      try {
        const config = requireCommandConfig(command);
        const exitCode = await docsGenerateCommand(options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  // Examples command
  program
    .command("examples <type>")
    .description("generate example projects by profile or language type")
    .option("--output <dir>", "output directory for examples", "./examples")
    .option("--profile <name>", "specific profile to generate (library, cli, service)")
    .option("--language <lang>", "specific language to generate (typescript, python, rust, go)")
    .option("--force", "overwrite existing examples")
    .action(async (type: string, options, command) => {
      try {
        const config = requireCommandConfig(command);
        const exitCode = await examplesCommand(type, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  // Execute command
  program
    .command("execute <epic>")
    .description("execute Arbiter epics for deterministic, agent-first code generation")
    .option("--stage <stage>", "execution stage (planning, implementation, testing, deployment)")
    .option("--parallel", "execute tasks in parallel where possible")
    .option("--dry-run", "preview execution plan without running tasks")
    .option("--continue-on-error", "continue execution even if some tasks fail")
    .option("--timeout <seconds>", "overall execution timeout in seconds", (value) =>
      Number.parseInt(value, 10),
    )
    .action(async (epic: string, options, command) => {
      try {
        const config = command.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await executeCommand({ epic });
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  // Explain command
  program
    .command("explain")
    .description("generate plain-English summary of project specifications")
    .option("--output <file>", "output file path (default: stdout)")
    .option("--format <format>", "output format (markdown, text)", "markdown")
    .option("--verbose", "detailed explanation with all configuration details")
    .action(async (options, command) => {
      try {
        const config = command.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await explainCommand(options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  // Rename command
  program
    .command("rename")
    .description("migrate existing files to project-specific naming")
    .option("--dry-run", "preview rename operations without applying them")
    .option("--pattern <pattern>", "file pattern to rename (glob syntax)")
    .option("--force", "force rename even if already using project-specific names")
    .option("--help-naming", "show naming convention help")
    .action(async (options, command) => {
      try {
        if (options.helpNaming) {
          showNamingHelp();
          return;
        }

        const config = command.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        // Parse types if provided
        const types = options.types
          ? options.types.split(",").map((t: string) => t.trim())
          : undefined;

        const renameOptions = {
          ...options,
          types,
        };

        const exitCode = await renameCommand(renameOptions, config);
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
