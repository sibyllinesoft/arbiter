/**
 * @packageDocumentation
 * Remove commands module - Specification element removal.
 *
 * Provides commands for removing services, endpoints, routes,
 * flows, databases, caches, and other specification elements.
 */

import { requireCommandConfig } from "@/cli/context.js";
import { removeCommand } from "@/services/remove/index.js";
import type { RemoveOptions } from "@/services/remove/index.js";
import chalk from "chalk";
import { Command } from "commander";

/** Supported entity types for the remove command */
type EntityType =
  | "service"
  | "endpoint"
  | "route"
  | "flow"
  | "load-balancer"
  | "database"
  | "cache"
  | "locator"
  | "schema"
  | "package"
  | "component"
  | "module";

/** Configuration for a remove subcommand */
interface RemoveSubcommandConfig {
  name: string;
  description: string;
  entityType: EntityType;
  hasArgument: boolean;
  argumentName?: string;
  extraOptions?: Array<{ flags: string; description: string; defaultValue?: string }>;
}

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
 * Create an action handler for a remove subcommand.
 * @param entityType - The type of entity being removed
 * @returns Action handler function for Commander
 */
function createRemoveActionHandler(entityType: EntityType) {
  return async (
    nameOrOptions: string | RemoveOptions,
    optionsOrCommand: RemoveOptions | Command,
    maybeCommand?: Command,
  ) => {
    const hasArgument = typeof nameOrOptions === "string";
    const name = hasArgument ? nameOrOptions : "";
    const options = hasArgument
      ? (optionsOrCommand as RemoveOptions)
      : (nameOrOptions as RemoveOptions);
    const command = hasArgument ? (maybeCommand as Command) : (optionsOrCommand as Command);

    try {
      const config = requireCommandConfig(command);
      const exitCode = await removeCommand(
        entityType,
        name,
        options as RemoveOptions & Record<string, unknown>,
        config,
      );
      process.exit(exitCode);
    } catch (error) {
      handleCommandError(error);
    }
  };
}

/**
 * Add common options (dry-run, force, verbose) to a command.
 * @param cmd - The command to add options to
 * @returns The command with options added
 */
function addCommonOptions(cmd: Command): Command {
  return cmd
    .option("--dry-run", "preview changes without applying them")
    .option("--force", "succeed even if the target does not exist")
    .option("--verbose", "show verbose logging");
}

/** Configuration array for all remove subcommands */
const REMOVE_SUBCOMMANDS: RemoveSubcommandConfig[] = [
  {
    name: "service <name>",
    description: "remove a service from the specification",
    entityType: "service",
    hasArgument: true,
  },
  {
    name: "endpoint <path>",
    description: "remove an API endpoint",
    entityType: "endpoint",
    hasArgument: true,
    extraOptions: [
      {
        flags: "--method <method>",
        description: "HTTP method to remove (defaults to entire endpoint)",
      },
      {
        flags: "--service <service>",
        description: "service that owns the endpoint",
        defaultValue: "api",
      },
    ],
  },
  {
    name: "route <path>",
    description: "remove a UI route by path or identifier",
    entityType: "route",
    hasArgument: true,
    extraOptions: [{ flags: "--id <id>", description: "explicit route identifier to remove" }],
  },
  {
    name: "flow <id>",
    description: "remove a user flow definition",
    entityType: "flow",
    hasArgument: true,
  },
  {
    name: "load-balancer",
    description: "remove the shared load balancer service",
    entityType: "load-balancer",
    hasArgument: false,
  },
  {
    name: "database <name>",
    description: "remove a database service",
    entityType: "database",
    hasArgument: true,
  },
  {
    name: "cache <name>",
    description: "remove a cache service",
    entityType: "cache",
    hasArgument: true,
  },
  {
    name: "locator <key>",
    description: "remove a locator from the specification",
    entityType: "locator",
    hasArgument: true,
  },
  {
    name: "schema <name>",
    description: "remove a schema definition",
    entityType: "schema",
    hasArgument: true,
  },
  {
    name: "package <name>",
    description: "remove a reusable package",
    entityType: "package",
    hasArgument: true,
  },
  {
    name: "component <name>",
    description: "remove a UI component definition",
    entityType: "component",
    hasArgument: true,
  },
  {
    name: "module <name>",
    description: "remove a standalone module definition",
    entityType: "module",
    hasArgument: true,
  },
];

/**
 * Create and register all remove subcommands on the given program.
 * @param program - The Commander program instance
 * @returns The remove command with all subcommands registered
 */
export function createRemoveCommands(program: Command): Command {
  const removeCmd = program
    .command("remove")
    .description("remove components from the project specification");

  for (const config of REMOVE_SUBCOMMANDS) {
    let subCmd = removeCmd.command(config.name).description(config.description);

    if (config.extraOptions) {
      for (const opt of config.extraOptions) {
        subCmd = opt.defaultValue
          ? subCmd.option(opt.flags, opt.description, opt.defaultValue)
          : subCmd.option(opt.flags, opt.description);
      }
    }

    subCmd = addCommonOptions(subCmd);
    subCmd.action(createRemoveActionHandler(config.entityType));
  }

  return removeCmd;
}
