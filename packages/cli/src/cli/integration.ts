/**
 * Integration commands module - CI/CD and external integrations
 */

import chalk from "chalk";
import { Command } from "commander";
import { githubTemplatesCommand } from "../commands/github-templates.js";
import { integrateProject } from "../services/integrate/index.js";
import { syncProject } from "../services/sync/index.js";
import type { IntegrateOptions, SyncOptions } from "../types.js";
import { requireCommandConfig } from "./context.js";

export function createIntegrationCommands(program: Command): void {
  // Sync command
  program
    .command("sync")
    .description("synchronize project manifests (package.json, pyproject.toml, etc.) with Arbiter")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "overwrite existing manifest entries")
    .option("--backup", "create backup files before modification")
    .action(async (options: SyncOptions, command) => {
      try {
        const config = requireCommandConfig(command);
        const exitCode = await syncProject(options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  // Integrate command
  program
    .command("integrate")
    .description("generate CI/CD workflows with contract coverage and quality gates")
    .option("--platform <platform>", "CI platform: github, gitlab, azure, all", "github")
    .option("--provider <name>", "CI provider: github, gitlab, azure, all", "github")
    .option("--type <type>", "workflow target: pr, main, release, all", "all")
    .option("--output <dir>", "directory for generated workflows", ".github/workflows")
    .option("--force", "overwrite existing workflow files")
    .option("--dry-run", "preview changes without applying them")
    .option("--templates", "generate GitHub issue templates from configuration")
    .action(async (options: IntegrateOptions, command) => {
      try {
        const config = requireCommandConfig(command);
        const exitCode = await integrateProject(options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  // GitHub Templates command
  program
    .command("github-templates")
    .description("manage GitHub issue templates configuration")
    .option("--list", "list all available templates")
    .option("--show <name>", "show details of a specific template")
    .option("--validate", "validate template configuration")
    .option("--generate", "generate templates from configuration")
    .option("--force", "overwrite existing template files")
    .action(async (options, command) => {
      try {
        const config = requireCommandConfig(command);
        const exitCode = await githubTemplatesCommand(options, config);
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
