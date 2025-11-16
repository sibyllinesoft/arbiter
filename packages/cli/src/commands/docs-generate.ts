/**
 * Documentation generation command
 *
 * Generates comprehensive CLI documentation from command structure
 */

import * as path from "path";
import chalk from "chalk";
import * as fs from "fs-extra";
import { CLIDocumentationGenerator } from "../docs/cli-doc-generator.js";
import { TemplateEngine } from "../docs/template-engine.js";
import type {
  AnalysisResult,
  DocGenerationOptions,
  ParsedCommandInfo,
  TemplateData,
} from "../docs/types.js";
import type { CLIConfig } from "../types.js";

/**
 * Command options for documentation generation
 */
export interface DocsGenerateOptions {
  /** Output directory for generated documentation */
  output?: string;
  /** Formats to generate (comma-separated) */
  formats?: string;
  /** Include examples in documentation */
  includeExamples?: boolean;
  /** Include internal/hidden commands */
  includeInternal?: boolean;
  /** Custom template directory */
  templateDir?: string;
  /** Enable table of contents */
  toc?: boolean;
  /** Enable search functionality (HTML only) */
  search?: boolean;
  /** Validate documentation completeness */
  validate?: boolean;
  /** Watch mode for development */
  watch?: boolean;
  /** Dry run mode */
  dryRun?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Generate CLI documentation command
 */
export async function docsGenerateCommand(
  options: DocsGenerateOptions,
  config: CLIConfig,
): Promise<number> {
  try {
    console.log(chalk.blue("📚 Generating CLI documentation..."));

    const outputDir = options.output || path.join(process.cwd(), "docs");
    const formats = (options.formats || "markdown").split(",").map((f) => f.trim()) as (
      | "markdown"
      | "json"
      | "html"
    )[];

    if (options.verbose) {
      console.log(chalk.dim(`Output directory: ${outputDir}`));
      console.log(chalk.dim(`Formats: ${formats.join(", ")}`));
    }

    // Import the CLI program
    const { default: program } = await import("../cli/index.js");

    // Generate documentation
    const generator = new CLIDocumentationGenerator(program);
    const templateEngine = new TemplateEngine();

    // Parse commands
    console.log(chalk.blue("🔍 Analyzing CLI structure..."));
    const commands = generator.parseCommands();

    if (options.verbose) {
      console.log(chalk.dim(`Found ${commands.length} commands`));
    }

    // Validate if requested
    if (options.validate) {
      console.log(chalk.blue("✅ Validating documentation..."));
      const analysis = analyzeDocumentation(commands);

      if (analysis.errors.length > 0) {
        console.log(chalk.red("❌ Documentation validation failed:"));
        for (const error of analysis.errors) {
          console.log(chalk.red(`  - ${error}`));
        }
        return 1;
      }

      if (analysis.warnings.length > 0) {
        console.log(chalk.yellow("⚠️  Documentation warnings:"));
        for (const warning of analysis.warnings) {
          console.log(chalk.yellow(`  - ${warning}`));
        }
      }

      printAnalysisStats(analysis.stats);
    }

    // Prepare template data
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

    // Generate documentation in requested formats
    if (options.dryRun) {
      console.log(chalk.yellow("🔍 Dry run - would generate:"));
      for (const format of formats) {
        const filename = getOutputFilename(format);
        console.log(chalk.dim(`  - ${path.join(outputDir, filename)}`));
      }
      return 0;
    }

    await fs.ensureDir(outputDir);

    for (const format of formats) {
      await generateDocumentationFormat(format, templateData, templateEngine, outputDir, options);
    }

    // Generate additional files
    if (formats.includes("html")) {
      await generateAssets(outputDir);
    }

    console.log(chalk.green("✅ Documentation generation completed!"));
    console.log(chalk.dim(`Output: ${outputDir}`));

    return 0;
  } catch (error) {
    console.error(
      chalk.red("Documentation generation failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Generate documentation for a specific format
 */
async function generateDocumentationFormat(
  format: "markdown" | "json" | "html",
  data: TemplateData,
  templateEngine: TemplateEngine,
  outputDir: string,
  options: DocsGenerateOptions,
): Promise<void> {
  console.log(chalk.blue(`📄 Generating ${format} documentation...`));

  const filename = getOutputFilename(format);
  const outputFile = path.join(outputDir, filename);

  if (format === "json") {
    // Special handling for JSON - just serialize the data
    const jsonData = {
      ...data,
      generatedBy: "Arbiter CLI Documentation Generator",
      schema: "https://arbiter.dev/schemas/cli-docs/v1.json",
    };

    await fs.writeFile(outputFile, JSON.stringify(jsonData, null, 2), "utf8");
  } else {
    // Use template engine for markdown and HTML
    const templateConfig = {
      format,
      template: format,
      filename,
      options: {
        includeToc: options.toc !== false,
        includeSearch: options.search !== false && format === "html",
        includeExamples: options.includeExamples !== false,
      },
    };

    const template = await templateEngine.loadTemplate(templateConfig);
    const content = templateEngine.render(template, data);

    await fs.writeFile(outputFile, content, "utf8");
  }

  console.log(chalk.green(`  ✅ ${filename}`));
}

/**
 * Generate additional assets for HTML documentation
 */
async function generateAssets(outputDir: string): Promise<void> {
  // Create a simple favicon
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#2563eb"/>
    <text x="50" y="65" font-family="monospace" font-size="60" text-anchor="middle" fill="white">A</text>
  </svg>`;

  await fs.writeFile(path.join(outputDir, "favicon.svg"), faviconSvg, "utf8");

  // Create a manifest.json for PWA capabilities
  const manifest = {
    name: "Arbiter CLI Reference",
    short_name: "Arbiter CLI",
    description: "Comprehensive documentation for the Arbiter CLI",
    start_url: "./cli-reference.html",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      {
        src: "favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };

  await fs.writeFile(
    path.join(outputDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
}

/**
 * Get output filename for format
 */
function getOutputFilename(format: string): string {
  switch (format) {
    case "markdown":
      return "cli-reference.md";
    case "json":
      return "cli-reference.json";
    case "html":
      return "cli-reference.html";
    default:
      return `cli-reference.${format}`;
  }
}

/**
 * Categorize commands by their metadata category
 */
function categorizeCommands(commands: ParsedCommandInfo[]): Record<string, ParsedCommandInfo[]> {
  const categories: Record<string, ParsedCommandInfo[]> = {};

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

/**
 * Extract global options from the root command
 */
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

/**
 * Analyze documentation completeness and quality
 */
function analyzeDocumentation(commands: ParsedCommandInfo[]): AnalysisResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let executableCommands = 0;
  let totalOptions = 0;
  const categoryCounts: Record<string, number> = {};

  for (const command of commands) {
    // Check for missing descriptions
    if (!command.description || command.description.trim().length === 0) {
      warnings.push(`Command '${command.fullName}' has no description`);
    }

    // Check for very short descriptions
    if (command.description && command.description.trim().length < 10) {
      warnings.push(`Command '${command.fullName}' has very short description`);
    }

    // Check options documentation
    for (const option of command.options) {
      if (!option.description || option.description.trim().length === 0) {
        warnings.push(`Option '${option.flags}' in '${command.fullName}' has no description`);
      }
      totalOptions++;
    }

    // Count categories
    const category = command.metadata.category;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    if (command.isExecutable) {
      executableCommands++;
    }
  }

  const stats = {
    totalCommands: commands.length,
    executableCommands,
    subcommands: commands.length - executableCommands,
    averageOptionsPerCommand: totalOptions / commands.length,
    categoryCounts,
  };

  return {
    commands,
    categories: categorizeCommands(commands),
    errors,
    warnings,
    stats,
  };
}

/**
 * Print analysis statistics
 */
function printAnalysisStats(stats: AnalysisResult["stats"]): void {
  console.log(chalk.blue("\n📊 Documentation Analysis:"));
  console.log(chalk.dim(`  Total commands: ${stats.totalCommands}`));
  console.log(chalk.dim(`  Executable commands: ${stats.executableCommands}`));
  console.log(chalk.dim(`  Subcommands: ${stats.subcommands}`));
  console.log(
    chalk.dim(`  Average options per command: ${stats.averageOptionsPerCommand.toFixed(1)}`),
  );

  console.log(chalk.dim(`  Commands by category:`));
  for (const [category, count] of Object.entries(stats.categoryCounts)) {
    console.log(chalk.dim(`    ${category}: ${count}`));
  }
}
