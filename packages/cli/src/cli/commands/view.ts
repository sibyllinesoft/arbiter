/**
 * @packageDocumentation
 * View command - View Arbiter vault in browser.
 */

import { requireCommandConfig } from "@/cli/context.js";
import { type ViewOptions, viewCommand } from "@/services/view/index.js";
import chalk from "chalk";
import { Command } from "commander";

/**
 * Handle command errors consistently.
 */
function handleCommandError(error: unknown): never {
  console.error(
    chalk.red("Command failed:"),
    error instanceof Error ? error.message : String(error),
  );
  process.exit(2);
}

/**
 * Register the view command.
 */
export function createViewCommand(program: Command): void {
  program
    .command("view")
    .description("view .arbiter vault in browser")
    .option("-p, --port <port>", "port for docsify server", "4000")
    .option("--no-browser", "don't open browser automatically")
    .action(async (options, command) => {
      try {
        const config = requireCommandConfig(command);

        const viewOptions: ViewOptions = {
          port: parseInt(options.port, 10),
          noBrowser: options.browser === false,
        };

        const exitCode = await viewCommand(viewOptions, config);
        process.exit(exitCode);
      } catch (error) {
        handleCommandError(error);
      }
    });
}
