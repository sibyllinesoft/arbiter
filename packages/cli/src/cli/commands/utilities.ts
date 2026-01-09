/**
 * @packageDocumentation
 * Utilities commands module - Import and other utility commands.
 *
 * Provides commands for importing CUE specification files
 * and other utility operations.
 */

import { requireCommandConfig } from "@/cli/context.js";
import { importSpec } from "@/services/spec-import/index.js";
import chalk from "chalk";
import { Command } from "commander";

/**
 * Creates and registers utility commands for the CLI program.
 * @param program - The Commander program instance to add commands to
 */
export function createUtilitiesCommands(program: Command): void {
  // Import command - imports CUE spec files to the Arbiter server
  program
    .command("import [file]")
    .description("import a CUE specification file to the Arbiter server")
    .option("-p, --project <id>", "target project ID")
    .option("--remote-path <path>", "override the remote path on the server")
    .option("--skip-validate", "skip local CUE validation before import")
    .option("--author <name>", "author name for the import commit")
    .option("-m, --message <text>", "commit message for the import")
    .action(async (file: string | undefined, options, command) => {
      try {
        const config = requireCommandConfig(command);

        const importOptions = {
          project: options.project,
          remotePath: options.remotePath,
          skipValidate: options.skipValidate,
          author: options.author,
          message: options.message,
        };

        const exitCode = await importSpec(file, importOptions, config);
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
