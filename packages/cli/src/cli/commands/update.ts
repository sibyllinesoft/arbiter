/**
 * @packageDocumentation
 * Update commands module - Provides CLI commands for modifying existing
 * entities in CUE specifications.
 *
 * Supports updating:
 * - Package properties (subtype, description, framework, etc.)
 * - Resource properties
 * - Arbitrary metadata via unknown flags
 */

import { requireCommandConfig } from "@/cli/context.js";
import { type UpdateOptions, runUpdateCommand } from "@/services/update/index.js";
import chalk from "chalk";
import { Command, Option } from "commander";

/**
 * Supported entity types for the update command.
 */
type UpdateableEntityType = "package" | "resource" | "group" | "task";

/**
 * Handle command errors by logging and exiting with error code 2.
 */
function handleCommandError(error: unknown): never {
  console.error(
    chalk.red("Command failed:"),
    error instanceof Error ? error.message : String(error),
  );
  process.exit(2);
}

/**
 * Parse unknown flags into a metadata object.
 * Unknown flags like --foo bar become { foo: "bar" }
 */
function parseUnknownFlags(args: string[]): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Check if next arg is a value (not another flag)
      if (nextArg && !nextArg.startsWith("--")) {
        // Try to parse as number or boolean
        if (nextArg === "true") {
          metadata[key] = true;
        } else if (nextArg === "false") {
          metadata[key] = false;
        } else if (!isNaN(Number(nextArg))) {
          metadata[key] = Number(nextArg);
        } else {
          metadata[key] = nextArg;
        }
        i += 2;
      } else {
        // Flag without value is a boolean true
        metadata[key] = true;
        i += 1;
      }
    } else {
      i += 1;
    }
  }

  return metadata;
}

/**
 * Create the update command handler for a specific entity type.
 */
function createUpdateHandler(entityType: UpdateableEntityType) {
  return async (slug: string, options: UpdateOptions, command: Command) => {
    try {
      const config = requireCommandConfig(command);

      // Parse unknown arguments as metadata
      const unknownArgs = command.args.slice(1); // Skip the slug argument
      const extraMetadata = parseUnknownFlags(unknownArgs);

      // Merge extra metadata into options
      options.metadata = { ...options.metadata, ...extraMetadata };

      const exitCode = await runUpdateCommand(entityType, slug, options, config);
      process.exit(exitCode);
    } catch (error) {
      handleCommandError(error);
    }
  };
}

/**
 * Creates the update command group.
 */
export function createUpdateCommands(): Command {
  const updateCmd = new Command("update")
    .description("Update existing entities in the specification")
    .allowUnknownOption(true);

  // Update package command
  updateCmd
    .command("package <slug>")
    .description("Update a package configuration")
    .option("--subtype <type>", "Set package subtype (service, frontend, tool, library, worker)")
    .option("--description <text>", "Update description")
    .option("--framework <name>", "Set framework")
    .option("--port <port>", "Set port (for services)", parseInt)
    .option("--member-of <group>", "Set group membership")
    .option("-v, --verbose", "Show verbose output")
    .option("--dry-run", "Show changes without applying")
    .allowUnknownOption(true)
    .action(createUpdateHandler("package"));

  // Update resource command
  updateCmd
    .command("resource <slug>")
    .description("Update a resource configuration")
    .option(
      "--kind <kind>",
      "Set resource kind (database, cache, queue, storage, container, gateway, external)",
    )
    .option("--description <text>", "Update description")
    .option("--image <image>", "Set container image")
    .option("--provider <name>", "Set provider (aws, gcp, azure)")
    .option("--engine <name>", "Set engine (postgres, mysql, redis)")
    .option("--version <version>", "Set version")
    .option("--member-of <group>", "Set group membership")
    .option("-v, --verbose", "Show verbose output")
    .option("--dry-run", "Show changes without applying")
    .allowUnknownOption(true)
    .action(createUpdateHandler("resource"));

  // Update group command
  updateCmd
    .command("group <slug>")
    .description("Update a group configuration")
    .option("--name <name>", "Set display name")
    .option("--description <text>", "Update description")
    .option("--kind <kind>", "Set group kind (group, milestone, epic, release)")
    .option("--status <status>", "Set status (open, closed, active)")
    .option("--due <date>", "Set due date (ISO format)")
    .option("--member-of <group>", "Set parent group")
    .option("-v, --verbose", "Show verbose output")
    .option("--dry-run", "Show changes without applying")
    .allowUnknownOption(true)
    .action(createUpdateHandler("group"));

  // Update task command
  updateCmd
    .command("task <slug>")
    .description("Update a task")
    .option("--title <title>", "Set task title")
    .option("--description <text>", "Update description")
    .option("--status <status>", "Set status (open, in_progress, blocked, review, done, closed)")
    .option("--priority <priority>", "Set priority (critical, high, medium, low)")
    .option("--assignees <names>", "Set assignees (comma-separated)")
    .option("--labels <labels>", "Set labels (comma-separated)")
    .option("--due <date>", "Set due date (ISO format)")
    .option("--milestone <slug>", "Set milestone")
    .option("--member-of <group>", "Set group membership")
    .option("-v, --verbose", "Show verbose output")
    .option("--dry-run", "Show changes without applying")
    .allowUnknownOption(true)
    .action(createUpdateHandler("task"));

  return updateCmd;
}

export default createUpdateCommands;
