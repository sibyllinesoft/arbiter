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

import { templateManager, extractVariablesFromCue } from "./templates/index.js";
import chalk from "chalk";

async function testTemplateSystem() {
  console.log(chalk.cyan("🧪 Testing Template System"));
  console.log();

  try {
    // Test 1: Load configuration
    console.log(chalk.blue("1. Loading template configuration..."));
    await templateManager.loadConfig();
    console.log(chalk.green("✅ Configuration loaded"));
    console.log();

    // Test 2: List available engines
    console.log(chalk.blue("2. Available engines:"));
    const engines = templateManager.getEngines();
    engines.forEach((engine) => console.log(`  • ${engine}`));
    console.log();

    // Test 3: List available templates
    console.log(chalk.blue("3. Available template aliases:"));
    const aliases = templateManager.getAliases();
    if (Object.keys(aliases).length === 0) {
      console.log(chalk.yellow("  No template aliases configured"));
    } else {
      Object.entries(aliases).forEach(([name, alias]) => {
        console.log(`  • ${chalk.green(name)}: ${alias.description} (${alias.engine})`);
        console.log(`    Source: ${alias.source}`);
      });
    }
    console.log();

    // Test 4: Show specific template
    const firstTemplate = Object.keys(aliases)[0];
    if (firstTemplate) {
      console.log(chalk.blue(`4. Details for template '${firstTemplate}':`));
      const alias = templateManager.getAlias(firstTemplate);
      if (alias) {
        console.log(`  Engine: ${alias.engine}`);
        console.log(`  Source: ${alias.source}`);
        console.log(`  Description: ${alias.description}`);
        if (alias.prerequisites) {
          console.log(`  Prerequisites: ${alias.prerequisites.join(", ")}`);
        }
      }
      console.log();
    }

    // Test 5: Variable extraction
    console.log(chalk.blue("5. Testing variable extraction:"));
    const sampleCue = `
package myproject

product: {
  name: "My Sample Project"
  goals: ["Build awesome software"]
}

services: {
  api: {
    serviceType: "bespoke"
    language: "typescript"
    type: "deployment"
    ports: [{ name: "http", port: 3000, targetPort: 3000 }]
  }
  database: {
    serviceType: "prebuilt"
    language: "container"
    image: "postgres:15"
    ports: [{ name: "db", port: 5432, targetPort: 5432 }]
  }
}
`;

    const variables = extractVariablesFromCue(sampleCue, "api");
    console.log("  Extracted variables:", JSON.stringify(variables, null, 2));
    console.log();

    console.log(chalk.green("🎉 Template system test completed successfully!"));
    console.log();
    console.log(chalk.bold("Next steps:"));
    console.log(
      "  1. Add custom templates with: arbiter templates add <name> --source <source> --description <desc>",
    );
    console.log("  2. Use templates with: arbiter add service myapi --template <template-name>");
  } catch (error) {
    console.error(chalk.red("❌ Template system test failed:"));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

// Run the test
testTemplateSystem().catch(console.error);
