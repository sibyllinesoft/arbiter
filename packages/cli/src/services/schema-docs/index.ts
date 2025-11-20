/**
 * Schema Documentation Generation Command
 *
 * CLI command to generate comprehensive documentation from CUE files.
 */

import { existsSync, mkdirSync } from "fs";
import path from "path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";

import { DocumentationGenerator } from "../../docs/documentation-generator.js";
import { EnhancedCUEParser } from "../../docs/enhanced-cue-parser.js";
import { CUESchemaParser } from "../../docs/schema-parser.js";

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
      const spinner = ora("Analyzing CUE schemas...").start();

      try {
        const inputDir = path.resolve(process.cwd(), options.input ?? "spec/schema");
        const outputDir = path.resolve(process.cwd(), options.output ?? "docs/schema");
        const formats = (options.format ?? "markdown,html").split(",");

        // Ensure input exists
        if (!existsSync(inputDir)) {
          spinner.fail(`Input directory not found: ${inputDir}`);
          return 1;
        }

        // Ensure output dir exists
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        const parser = options.enhanced
          ? new EnhancedCUEParser({ includePrivate: options.includePrivate })
          : new CUESchemaParser({ includePrivate: options.includePrivate });

        const generator = new DocumentationGenerator({
          title: options.title ?? "Schema Documentation",
          includeExamples: options.includeExamples ?? true,
          includeRelationships: options.includeRelationships ?? true,
          verbose: options.verbose,
        });

        spinner.text = "Parsing schemas";
        const schema = await parser.parseDirectory(inputDir);

        spinner.text = "Generating documentation";
        await generator.generate({ schema, formats, outputDir });

        spinner.succeed("Documentation generated successfully");
        console.log(chalk.green("Output directory:"), chalk.dim(outputDir));
        return 0;
      } catch (error) {
        spinner.fail("Failed to generate documentation");
        console.error(chalk.red("Error:"), error instanceof Error ? error.message : String(error));
        return 1;
      }
    });
}

/**
 * Non-CLI helper to generate documentation programmatically.
 */
export async function generateSchemaDocumentation(
  inputDir: string,
  outputDir: string,
  options: Partial<SchemaDocsCommandOptions> = {},
): Promise<void> {
  const formats = (options.format ?? "markdown,html").split(",");
  const parser = options.enhanced
    ? new EnhancedCUEParser({ includePrivate: options.includePrivate })
    : new CUESchemaParser({ includePrivate: options.includePrivate });
  const generator = new DocumentationGenerator({
    title: options.title ?? "Schema Documentation",
    includeExamples: options.includeExamples ?? true,
    includeRelationships: options.includeRelationships ?? true,
    verbose: options.verbose,
  });

  const schema = await parser.parseDirectory(inputDir);
  await generator.generate({ schema, formats, outputDir });
}
