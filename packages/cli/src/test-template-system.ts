#!/usr/bin/env node

/**
 * Test script for the template system
 *
 * This script tests the template system functionality:
 * 1. Load configuration
 * 2. List available templates
 * 3. Show template details
 * 4. Test variable extraction
 */

import chalk from "chalk";
import { buildTemplateContext, templateOrchestrator } from "./templates/index.js";

async function testTemplateSystem() {
  console.log(chalk.cyan("🧪 Testing Template System"));
  console.log();

  try {
    await runConfigurationTest();
    await runEngineTest();
    await runTemplateListingTest();
    await runTemplateDetailsTest();
    await runVariableExtractionTest();

    displaySuccessMessage();
  } catch (error) {
    handleTestFailure(error);
  }
}

/**
 * Test template configuration loading
 */
async function runConfigurationTest(): Promise<void> {
  console.log(chalk.blue("1. Loading template configuration..."));
  await templateOrchestrator.loadConfig();
  console.log(chalk.green("✅ Configuration loaded"));
  console.log();
}

/**
 * Test available template implementors
 */
async function runEngineTest(): Promise<void> {
  console.log(chalk.blue("2. Available implementors:"));
  const implementors = templateOrchestrator.getImplementors();
  implementors.forEach((implementor) => console.log(`  • ${implementor}`));
  console.log();
}

/**
 * Test template alias listing
 */
async function runTemplateListingTest(): Promise<void> {
  console.log(chalk.blue("3. Available template aliases:"));
  const aliases = templateOrchestrator.getAliases();

  if (Object.keys(aliases).length === 0) {
    console.log(chalk.yellow("  No template aliases configured"));
  } else {
    displayTemplateAliases(aliases);
  }
  console.log();
}

/**
 * Display template aliases with details
 */
function displayTemplateAliases(aliases: any): void {
  Object.entries(aliases).forEach(([name, alias]: [string, any]) => {
    console.log(`  • ${chalk.green(name)}: ${alias.description} (${alias.implementor})`);
    console.log(`    Source: ${alias.source}`);
  });
}

/**
 * Test template details display
 */
async function runTemplateDetailsTest(): Promise<void> {
  const aliases = templateOrchestrator.getAliases();
  const firstTemplate = Object.keys(aliases)[0];

  if (firstTemplate) {
    console.log(chalk.blue(`4. Details for template '${firstTemplate}':`));
    displayTemplateDetails(firstTemplate);
    console.log();
  }
}

/**
 * Display details for a specific template
 */
function displayTemplateDetails(templateName: string): void {
  const alias = templateOrchestrator.getAlias(templateName);
  if (alias) {
    console.log(`  Implementor: ${alias.implementor}`);
    console.log(`  Source: ${alias.source}`);
    console.log(`  Description: ${alias.description}`);
    if (alias.prerequisites) {
      console.log(`  Prerequisites: ${alias.prerequisites.join(", ")}`);
    }
  }
}

/**
 * Test variable extraction functionality
 */
async function runVariableExtractionTest(): Promise<void> {
  console.log(chalk.blue("5. Testing variable extraction:"));

  const sampleCue = createSampleCueContent();
  const context = await buildTemplateContext(sampleCue, { artifactName: "api" });

  console.log("  Extracted context:", JSON.stringify(context, null, 2));
  console.log();
}

/**
 * Create sample CUE content for testing
 */
function createSampleCueContent(): string {
  return `
package myproject

product: {
  name: "My Sample Project"
  goals: ["Build awesome software"]
}

services: {
  api: {
    type: "internal",
    workload: "deployment"
    language: "typescript"
    type: "deployment"
    ports: [{ name: "http", port: 3000, targetPort: 3000 }]
  }
  database: {
    type: "external",
    workload: "statefulset"
    language: "container"
    image: "postgres:15"
    ports: [{ name: "db", port: 5432, targetPort: 5432 }]
  }
}
`;
}

/**
 * Display success message and next steps
 */
function displaySuccessMessage(): void {
  console.log(chalk.green("🎉 Template system test completed successfully!"));
  console.log();
  console.log(chalk.bold("Next steps:"));
  console.log(
    "  1. Add custom templates with: arbiter templates add <name> --source <source> --description <desc>",
  );
  console.log("  2. Use templates with: arbiter add service myapi --template <template-name>");
}

/**
 * Handle test failure
 */
function handleTestFailure(error: unknown): void {
  console.error(chalk.red("❌ Template system test failed:"));
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}

// Only run the template system check when executed directly, not during bun test discovery.
if (import.meta.main) {
  testTemplateSystem().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
