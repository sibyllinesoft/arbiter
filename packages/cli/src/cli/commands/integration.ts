/**
 * @packageDocumentation
 * Integration commands module - CI/CD and external integrations.
 *
 * Provides commands for project synchronization with manifests
 * and external build systems.
 */

import { requireCommandConfig } from "@/cli/context.js";
import { syncProject } from "@/services/sync/index.js";
import type { SyncOptions } from "@/types.js";
import chalk from "chalk";
import { Command } from "commander";

/**
 * Creates and registers integration commands for the CLI program.
 * @param program - The Commander program instance to add commands to
 */
export function createIntegrationCommands(program: Command): void {
  // Sync command
  program
    .command("sync")
    .description("synchronize project manifests (package.json, pyproject.toml, etc.) with Arbiter")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "overwrite existing manifest entries")
    .option("--backup", "create backup files before modification")
    .option("--github", "sync tasks/groups with GitHub issues (requires GITHUB_TOKEN)")
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
}
