/**
 * Remove commands module - Specification element removal
 */

import chalk from "chalk";
import { Command } from "commander";
import { removeCommand } from "../commands/remove.js";
import type { RemoveOptions } from "../commands/remove.js";

export function createRemoveCommands(program: Command): Command {
  const removeCmd = program
    .command("remove")
    .description("remove components from the project specification");

  removeCmd
    .command("service <name>")
    .description("remove a service from the specification")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "succeed even if the target does not exist")
    .option("--verbose", "show verbose logging")
    .action(async (name: string, options: RemoveOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await removeCommand("service", name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  removeCmd
    .command("endpoint <path>")
    .description("remove an API endpoint")
    .option("--method <method>", "HTTP method to remove (defaults to entire endpoint)")
    .option("--service <service>", "service that owns the endpoint", "api")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "succeed even if the target does not exist")
    .option("--verbose", "show verbose logging")
    .action(async (endpoint: string, options: RemoveOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await removeCommand("endpoint", endpoint, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  removeCmd
    .command("route <path>")
    .description("remove a UI route by path or identifier")
    .option("--id <id>", "explicit route identifier to remove")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "succeed even if the target does not exist")
    .option("--verbose", "show verbose logging")
    .action(async (routePath: string, options: RemoveOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await removeCommand("route", routePath, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  removeCmd
    .command("flow <id>")
    .description("remove a user flow definition")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "succeed even if the target does not exist")
    .option("--verbose", "show verbose logging")
    .action(async (flowId: string, options: RemoveOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await removeCommand("flow", flowId, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  removeCmd
    .command("load-balancer")
    .description("remove the shared load balancer service")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "succeed even if the target does not exist")
    .option("--verbose", "show verbose logging")
    .action(async (options: RemoveOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await removeCommand("load-balancer", "", options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  removeCmd
    .command("database <name>")
    .description("remove a database service")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "succeed even if the target does not exist")
    .option("--verbose", "show verbose logging")
    .action(async (name: string, options: RemoveOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await removeCommand("database", name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  removeCmd
    .command("cache <name>")
    .description("remove a cache service")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "succeed even if the target does not exist")
    .option("--verbose", "show verbose logging")
    .action(async (name: string, options: RemoveOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await removeCommand("cache", name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  removeCmd
    .command("locator <key>")
    .description("remove a locator from the specification")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "succeed even if the target does not exist")
    .option("--verbose", "show verbose logging")
    .action(async (key: string, options: RemoveOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await removeCommand("locator", key, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  removeCmd
    .command("schema <name>")
    .description("remove a schema definition")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "succeed even if the target does not exist")
    .option("--verbose", "show verbose logging")
    .action(async (name: string, options: RemoveOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await removeCommand("schema", name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  removeCmd
    .command("package <name>")
    .description("remove a reusable package")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "succeed even if the target does not exist")
    .option("--verbose", "show verbose logging")
    .action(async (name: string, options: RemoveOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await removeCommand("package", name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  removeCmd
    .command("component <name>")
    .description("remove a UI component definition")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "succeed even if the target does not exist")
    .option("--verbose", "show verbose logging")
    .action(async (name: string, options: RemoveOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await removeCommand("component", name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  removeCmd
    .command("module <name>")
    .description("remove a standalone module definition")
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "succeed even if the target does not exist")
    .option("--verbose", "show verbose logging")
    .action(async (name: string, options: RemoveOptions, command) => {
      try {
        const config = command.parent?.parent?.config;
        if (!config) {
          throw new Error("Configuration not loaded");
        }

        const exitCode = await removeCommand("module", name, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });

  return removeCmd;
}
