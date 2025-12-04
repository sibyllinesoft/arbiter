#!/usr/bin/env bun

/**
 * CLI Documentation Generation Demo
 *
 * This script demonstrates the CLI documentation generation system
 * by generating documentation from the actual CLI structure.
 */

import * as path from "path";
import { safeFileOperation } from "@/constraints/index.js";
import { CLIDocumentationGenerator } from "@/docs/cli-doc-generator.js";
import { DocsTemplateImplementor } from "@/docs/template-implementor.js";
import type { TemplateData } from "@/docs/types.js";
import chalk from "chalk";
import * as fs from "fs-extra";

async function writeDemoFile(filePath: string, content: string): Promise<void> {
  await safeFileOperation("write", filePath, async (validatedPath) => {
    await fs.writeFile(validatedPath, content, "utf8");
  });
}

async function main() {
  console.log(chalk.blue("🚀 CLI Documentation Generation Demo"));
  console.log(chalk.dim("This demo shows how to generate comprehensive CLI docs"));

  try {
    // Import the CLI program
    const { default: program } = await import("@/cli/index.js");

    console.log(chalk.blue("\n📖 Step 1: Analyzing CLI structure..."));

    // Initialize generator
    const generator = new CLIDocumentationGenerator(program);
    const templateEngine = new DocsTemplateImplementor();

    // Parse all commands
    const commands = generator.parseCommands();
    console.log(chalk.green(`✅ Found ${commands.length} commands`));

    // Show some analysis
    const categories = commands.reduce(
      (acc, cmd) => {
        const cat = cmd.metadata.category;
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    console.log(chalk.dim("\nCommand categories:"));
    for (const [category, count] of Object.entries(categories)) {
      console.log(chalk.dim(`  ${category}: ${count} commands`));
    }

    // Show example commands
    console.log(chalk.blue("\n🔍 Step 2: Sample command analysis..."));
    const sampleCommands = commands.slice(0, 3);
    for (const cmd of sampleCommands) {
      console.log(chalk.dim(`\n${cmd.fullName}:`));
      console.log(chalk.dim(`  Description: ${cmd.description}`));
      console.log(chalk.dim(`  Options: ${cmd.options.length}`));
      console.log(chalk.dim(`  Arguments: ${cmd.arguments.length}`));
      console.log(chalk.dim(`  Category: ${cmd.metadata.category}`));
      console.log(chalk.dim(`  Tags: ${cmd.metadata.tags.join(", ") || "none"}`));
    }

    // Prepare template data
    console.log(chalk.blue("\n📝 Step 3: Generating documentation..."));

    const templateData: TemplateData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: program.version() || "1.0.0",
        commandCount: commands.length,
      },
      categories: categorizeCommands(commands),
      commands,
      globalOptions: extractGlobalOptions(program),
    };

    // Generate markdown sample
    const markdownTemplate = templateEngine.getBuiltInTemplate({
      format: "markdown",
      template: "markdown",
      filename: "cli-reference.md",
    });

    const markdownContent = templateEngine.render(markdownTemplate, templateData);

    // Create demo output directory
    const demoDir = path.join(process.cwd(), "docs-demo");
    await fs.ensureDir(demoDir);

    // Write markdown example
    const markdownFile = path.join(demoDir, "cli-reference.md");
    await writeDemoFile(markdownFile, markdownContent);
    console.log(chalk.green(`✅ Generated markdown: ${markdownFile}`));

    // Generate JSON example
    const jsonData = {
      ...templateData,
      generatedBy: "Arbiter CLI Documentation Generator Demo",
      schema: "https://arbiter.dev/schemas/cli-docs/v1.json",
    };

    const jsonFile = path.join(demoDir, "cli-reference.json");
    await writeDemoFile(jsonFile, JSON.stringify(jsonData, null, 2));
    console.log(chalk.green(`✅ Generated JSON: ${jsonFile}`));

    // Generate HTML example
    const htmlTemplate = templateEngine.getBuiltInTemplate({
      format: "html",
      template: "html",
      filename: "cli-reference.html",
      options: {
        includeSearch: true,
        includeToc: true,
      },
    });

    const htmlContent = templateEngine.render(htmlTemplate, templateData);
    const htmlFile = path.join(demoDir, "cli-reference.html");
    await writeDemoFile(htmlFile, htmlContent);
    console.log(chalk.green(`✅ Generated HTML: ${htmlFile}`));

    // Show summary
    console.log(chalk.blue("\n📊 Documentation Generation Summary:"));
    console.log(chalk.green(`✅ Commands analyzed: ${commands.length}`));
    console.log(chalk.green(`✅ Categories: ${Object.keys(categories).length}`));
    console.log(chalk.green(`✅ Formats generated: 3 (Markdown, JSON, HTML)`));
    console.log(chalk.green(`✅ Output directory: ${demoDir}`));

    // Show file sizes
    console.log(chalk.blue("\nGenerated files:"));
    const files = await fs.readdir(demoDir);
    for (const file of files) {
      const filePath = path.join(demoDir, file);
      const stats = await fs.stat(filePath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(chalk.dim(`  ${file}: ${sizeKB} KB`));
    }

    console.log(chalk.green(`\n🎉 Demo completed successfully!`));
    console.log(
      chalk.dim(
        `Open ${path.join(demoDir, "cli-reference.html")} in a browser to see the interactive documentation.`,
      ),
    );
  } catch (error) {
    console.error(
      chalk.red("Demo failed:"),
      error instanceof Error ? error.message : String(error),
    );
    console.error(error);
    process.exit(1);
  }
}

/**
 * Helper functions (duplicated from main generator for demo purposes)
 */

function categorizeCommands(commands: any[]): Record<string, any[]> {
  const categories: Record<string, any[]> = {};

  for (const command of commands) {
    const category = command.metadata.category;
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(command);
  }

  // Sort commands within each category
  for (const category of Object.keys(categories)) {
    categories[category].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  return categories;
}

function extractGlobalOptions(program: any): Array<{
  flags: string;
  description: string;
  required: boolean;
  defaultValue?: any;
}> {
  return program.options.map((option: any) => ({
    flags: option.flags,
    description: option.description || "",
    required: option.required,
    defaultValue: option.defaultValue,
  }));
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
