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
import { createUtilitiesCommands } from "@/cli/commands/utilities.js";
import { hydrateCliContext } from "@/cli/context.js";
import chalk from "chalk";
import { Command } from "commander";

// Create the main program
const program = new Command();

// Global options and configuration
program
  .name("arbiter")
  .description("Arbiter CLI for CUE validation and management")
  .version("1.0.0")
  .addHelpCommand(false)
  .option("-c, --config <path>", "path to configuration file")
  .option("--no-color", "disable colored output")
  .option("--api-url <url>", "Arbiter API server URL (overrides config)")
  .option("--timeout <ms>", "request timeout in milliseconds")
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
createUtilitiesCommands(program);
createAuthCommand(program);
createPlanCommand(program);
createDesignCommand(program);

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
${chalk.cyan("Arbiter CLI - Agent-Friendly Specification Management")}

${chalk.yellow("Core Workflows:")}

  ${chalk.green("1. FEATURE PLANNING (AI-Assisted):")}
    arbiter plan                         # Interactive feature planning prompt
    arbiter design                       # Detailed technical design (after plan)

  ${chalk.green("2. SPEC FRAGMENT MANAGEMENT (Git-Style):")}
    arbiter init my-app --preset web-app # Initialize from a hosted preset
    arbiter add service billing          # Add service specification
    arbiter add api/order                # Add API endpoint specification
    arbiter add flow checkout            # Add user flow specification
    arbiter generate                     # Generate code from specifications

  ${chalk.green("3. VALIDATION & FEEDBACK:")}
    arbiter check                        # Validate all specifications

${chalk.yellow("Examples:")}
  arbiter check **/*.cue --format=json  # Validate with JSON output
  arbiter surface app.py --output=cue   # Extract API surface from code
  arbiter health                        # Check server connectivity

For detailed help: arbiter <command> --help
`,
);

export default program;
