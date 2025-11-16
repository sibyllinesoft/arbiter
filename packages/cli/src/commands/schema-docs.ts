/**
 * Schema Documentation Generation Command
 *
 * CLI command to generate comprehensive schema documentation from CUE files.
 */

import { existsSync, mkdirSync } from "fs";
import path from "path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";

import { DocumentationGenerator } from "../docs/documentation-generator.js";
import { EnhancedCUEParser } from "../docs/enhanced-cue-parser.js";
import { CUESchemaParser } from "../docs/schema-parser.js";

export interface SchemaDocsCommandOptions {
  input?: string;
  output?: string;
  format?: string;
  title?: string;
  enhanced?: boolean;
  includePrivate?: boolean;
  includeExamples?: boolean;
  includeRelationships?: boolean;
  verbose?: boolean;
}

export function createSchemaDocsCommand(): Command {
  return new Command("schema-docs")
    .description("Generate comprehensive documentation from CUE schema files")
    .option("-i, --input <path>", "Input directory containing CUE schema files", "spec/schema")
    .option("-o, --output <path>", "Output directory for generated documentation", "docs/schema")
    .option("-f, --format <formats>", "Output formats (markdown,html,json)", "markdown,html")
    .option("-t, --title <title>", "Documentation title", "Schema Documentation")
    .option("--enhanced", "Use enhanced parser for complex CUE constructs", false)
    .option("--include-private", "Include private types (starting with _)", false)
    .option("--no-examples", "Exclude examples from documentation")
    .option("--no-relationships", "Exclude type relationships from documentation")
    .option("-v, --verbose", "Verbose output", false)
    .action(async (options: SchemaDocsCommandOptions) => {
      await generateSchemaDocumentation(options);
    });
}

export async function generateSchemaDocumentation(
  options: SchemaDocsCommandOptions,
): Promise<number> {
  const spinner = ora("Generating schema documentation...").start();

  try {
    // Validate input directory
    const inputDir = path.resolve(options.input || "spec/schema");
    if (!existsSync(inputDir)) {
      spinner.fail(chalk.red(`Input directory not found: ${inputDir}`));
      return 1;
    }

    // Prepare output directory
    const outputDir = path.resolve(options.output || "docs/schema");
    mkdirSync(outputDir, { recursive: true });

    if (options.verbose) {
      spinner.info(`Input: ${inputDir}`);
      spinner.info(`Output: ${outputDir}`);
    }

    // Parse schemas
    spinner.text = "Parsing CUE schema files...";

    let schema;
    if (options.enhanced) {
      const enhancedParser = new EnhancedCUEParser();
      schema = await enhancedParser.parseSchemaDirectory(inputDir);
    } else {
      const parser = new CUESchemaParser();
      const schemaFiles = findCUEFiles(inputDir);

      if (schemaFiles.length === 0) {
        spinner.fail(chalk.red(`No CUE files found in ${inputDir}`));
        return 1;
      }

      schema = parser.parseFiles(schemaFiles);
    }

    if (options.verbose) {
      spinner.info(`Parsed ${schema.types.size} types from ${schema.package} package`);
    }

    // Generate documentation
    spinner.text = "Generating documentation...";

    const formats = (options.format || "markdown,html").split(",").map((f) => f.trim()) as (
      | "markdown"
      | "html"
      | "json"
    )[];

    const generator = new DocumentationGenerator({
      outputDir,
      formats,
      title: options.title,
      includePrivateTypes: options.includePrivate,
      includeExamples: options.includeExamples !== false,
      includeRelationships: options.includeRelationships !== false,
    });

    await generator.generate(schema);

    // Success message
    spinner.succeed(chalk.green("Documentation generated successfully!"));

    console.log("\n" + chalk.bold("Generated files:"));
    for (const format of formats) {
      const extension = format === "markdown" ? "md" : format;
      const filePath = path.join(outputDir, `schema.${extension}`);
      console.log(chalk.cyan(`  - ${filePath}`));
    }

    console.log("\n" + chalk.bold("Documentation statistics:"));
    console.log(chalk.gray(`  Types: ${schema.types.size}`));
    console.log(chalk.gray(`  Package: ${schema.package}`));
    if (schema.imports.length > 0) {
      console.log(chalk.gray(`  Imports: ${schema.imports.length}`));
    }

    // Display type breakdown
    const typeStats = getTypeStatistics(schema);
    for (const [kind, count] of Object.entries(typeStats)) {
      if (count > 0) {
        console.log(chalk.gray(`  ${kind}: ${count}`));
      }
    }

    return 0;
  } catch (error) {
    spinner.fail(chalk.red("Documentation generation failed"));
    console.error(chalk.red("Error:"), error instanceof Error ? error.message : String(error));

    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }

    return 1;
  }
}

function findCUEFiles(dir: string): string[] {
  const fs = require("fs");
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findCUEFiles(fullPath));
      } else if (entry.name.endsWith(".cue")) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Could not read directory ${dir}: ${error}`);
  }

  return files;
}

function getTypeStatistics(schema: any): Record<string, number> {
  const stats: Record<string, number> = {
    Structs: 0,
    Enums: 0,
    Constraints: 0,
    Unions: 0,
    Primitives: 0,
  };

  for (const type of schema.types.values()) {
    switch (type.kind) {
      case "struct":
        stats["Structs"]++;
        break;
      case "enum":
        stats["Enums"]++;
        break;
      case "constraint":
        stats["Constraints"]++;
        break;
      case "union":
        stats["Unions"]++;
        break;
      case "primitive":
        stats["Primitives"]++;
        break;
    }
  }

  return stats;
}

// Export for programmatic use
export { CUESchemaParser, EnhancedCUEParser, DocumentationGenerator };
