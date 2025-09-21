#!/usr/bin/env node

/**
 * Arbiter CLI - Modular entry point
 *
 * This module imports all command modules and creates a unified CLI interface.
 */

import chalk from "chalk";
import { Command } from "commander";
import { loadConfig } from "../config.js";
import { createAddCommands } from "./add.js";
import { createEpicTaskCommands } from "./epic-task.js";
import { createGenerationCommands } from "./generation.js";
import { createIntegrationCommands } from "./integration.js";
import { createProjectCommands } from "./project.js";
import { createUtilitiesCommands } from "./utilities.js";
import { createVersionCommands } from "./version.js";
import { createWebhookCommands } from "./webhook.js";

// Create the main program
const program = new Command();

// Global options and configuration
program
  .name("arbiter")
  .description("Arbiter CLI for CUE validation and management")
  .version("1.0.0")
  .option("-c, --config <path>", "path to configuration file")
  .option("--no-color", "disable colored output")
  .option("--api-url <url>", "API server URL")
  .option("--timeout <ms>", "request timeout in milliseconds")
  .hook("preAction", async (thisCommand, actionCommand) => {
    try {
      // Load basic configuration before running any command
      const opts = thisCommand.opts();

      const config = await loadConfig(opts.config);

      // Override config with CLI options
      if (opts.apiUrl) config.apiUrl = opts.apiUrl;
      if (opts.timeout) config.timeout = Number.parseInt(opts.timeout, 10);
      if (opts.color === false) config.color = false;

      // Store config on command for subcommands to access
      (thisCommand as any).config = config;
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
const addCmd = createAddCommands(program);
createVersionCommands(program);
createEpicTaskCommands(addCmd); // Epic and task are subcommands of add
createGenerationCommands(program);
createIntegrationCommands(program);
createUtilitiesCommands(program);

// Add webhook command
const webhookCmd = createWebhookCommands();
program.addCommand(webhookCmd);

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

  ${chalk.green("1. SPEC FRAGMENT MANAGEMENT (Git-Style):")}
    arbiter init my-app --schema=app     # Initialize with app-centric schema 
    arbiter add service billing          # Add service specification
    arbiter add api/order                # Add API endpoint specification
    arbiter add flow checkout            # Add user flow specification
    arbiter generate                     # Generate code from specifications

  ${chalk.green("2. VALIDATION & FEEDBACK:")}
    arbiter check                        # Validate all specifications
    arbiter watch                        # Watch mode with live validation

  ${chalk.green("3. RELEASE MANAGEMENT:")}
    arbiter version plan                 # Plan version changes
    arbiter integrate                    # Generate CI/CD workflows

${chalk.yellow("Schema Formats:")}
  app: Complete application modeling

${chalk.yellow("Agent-Friendly Features:")}
  • Non-interactive commands (no prompts)
  • Structured JSON output (--format=json)
  • Exit codes: 0=success, 1=error, 2=config
  • NDJSON streaming (--ndjson-output)

${chalk.yellow("Examples:")}
  arbiter check **/*.cue --format=json  # Validate with JSON output
  arbiter surface app.py --output=cue   # Extract API surface from code
  arbiter health                        # Check server connectivity

For detailed help: arbiter <command> --help
`,
);

export default program;

// If this file is run directly, parse arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}
