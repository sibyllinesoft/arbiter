#!/usr/bin/env node

/**
 * @packageDocumentation
 * Arbiter CLI - Modular entry point.
 *
 * This module imports all command modules and creates a unified CLI interface.
 * It serves as the main entry point for the Arbiter command-line tool.
 */

import { createAddCommands } from "@/cli/commands/add.js";
import { createAuthCommand } from "@/cli/commands/auth.js";
import { createDesignCommand } from "@/cli/commands/design.js";
import { createGenerationCommands } from "@/cli/commands/generation.js";
import { createIntegrationCommands } from "@/cli/commands/integration.js";
import { createPlanCommand } from "@/cli/commands/plan.js";
import { createProjectCommands } from "@/cli/commands/project.js";
import { createRemoveCommands } from "@/cli/commands/remove.js";
import { createUpdateCommands } from "@/cli/commands/update.js";
import { createViewCommand } from "@/cli/commands/view.js";
import { hydrateCliContext } from "@/cli/context.js";
import chalk from "chalk";
import { Command } from "commander";

// Create the main program
const program = new Command();

// Global options and configuration
program
  .name("arbiter")
  .description(
    "Spec-driven development CLI. Track work with tasks, persist context with notes, define architecture with specs.",
  )
  .version("1.0.0")
  .addHelpCommand(false)
  .option("-c, --config <path>", "path to configuration file")
  .option("--api-url <url>", "Arbiter API server URL (overrides config)")
  .option("--local", "operate in offline mode using local CUE files only")
  .option("-v, --verbose", "enable verbose logging globally")
  .hook("preAction", async (thisCommand, actionCommand) => {
    try {
      await hydrateCliContext(thisCommand, actionCommand);
    } catch (error) {
      console.error(
        chalk.red("Configuration error:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(2);
    }
  });

// Create and configure all command modules
createProjectCommands(program);
createAddCommands(program);
program.addCommand(createUpdateCommands());
createRemoveCommands(program);
createGenerationCommands(program);
createIntegrationCommands(program);
createAuthCommand(program);
createPlanCommand(program);
createDesignCommand(program);
createViewCommand(program);

// Handle unknown commands
program.on("command:*", () => {
  console.error(chalk.red("Unknown command:"), program.args.join(" "));
  console.log(chalk.dim("Run --help for available commands"));
  process.exit(1);
});

// Enhanced help with examples
program.addHelpText(
  "after",
  `
${chalk.cyan("━━━ SPEC-DRIVEN DEVELOPMENT ━━━")}

Arbiter manages your project through ${chalk.bold("tasks")} (work items), ${chalk.bold("notes")} (persistent context),
and ${chalk.bold("specs")} (architecture definitions). All data is stored as markdown in ${chalk.dim(".arbiter/")}.

${chalk.yellow("AGENT WORKFLOW")}

  ${chalk.green("1. Before starting work:")}
     arbiter add task "Implement user auth"    # Create a task to track work
     arbiter list task --status open           # See open tasks

  ${chalk.green("2. While working:")}
     arbiter add note "Chose JWT over sessions because..." --target auth-service
     arbiter update task auth-task --status in_progress

  ${chalk.green("3. Persist decisions & context:")}
     arbiter add note "API uses snake_case" --kind guidance --target api
     arbiter add note "User confirmed: no OAuth needed" --kind decision

  ${chalk.green("4. Track completion:")}
     arbiter update task auth-task --status done
     arbiter status                            # Validate and review

${chalk.yellow("QUICK REFERENCE")}

  ${chalk.bold("Tasks")} - Work items (bugs, features, stories)
    arbiter add task "title"                   # Create task
    arbiter list task                          # List all tasks
    arbiter list task --status open --priority high
    arbiter update task <slug> --status done

  ${chalk.bold("Notes")} - Persistent context attached to entities
    arbiter add note "content" --target <entity>
    arbiter list note --target auth-service
    arbiter list note --kind decision          # Find all decisions

  ${chalk.bold("Specs")} - Architecture definitions (greenfield projects)
    arbiter add service billing --port 3000
    arbiter add package shared-utils --subtype library
    arbiter list service

${chalk.yellow("NOTE KINDS")}: discussion, guidance, memory, decision, note
${chalk.yellow("TASK STATUS")}: open, in_progress, blocked, review, done, closed

${chalk.dim("Data stored in .arbiter/tasks/*.md and .arbiter/notes/*.md (Obsidian-compatible)")}
`,
);

export default program;
