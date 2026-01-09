#!/usr/bin/env node
/**
 * @packageDocumentation
 * Examples command - Generate example project structures and templates.
 *
 * Provides functionality to:
 * - Generate TypeScript library examples
 * - Generate CLI tool examples
 * - Generate Python service examples
 * - Scaffold complete project structures with configurations
 */

import fs from "node:fs/promises";
import path from "node:path";
import { safeFileOperation } from "@/constraints/index.js";
import type { Config } from "@/io/config/config.js";
import {
  expandContent,
  getCliAssemblyCue,
  getCliBin,
  getCliHelloCommand,
  getCliPackageJson,
  getCliReadme,
  getCliSrc,
  getCliTests,
  getGoServiceAssemblyCue,
  getGoServiceConfig,
  getGoServiceGoMod,
  getGoServiceHandlers,
  getGoServiceMain,
  getGoServiceReadme,
  getLibraryAssemblyCue,
  getMonorepoAssemblyCue,
  getMonorepoCliPackageJson,
  getMonorepoCorePackageJson,
  getMonorepoPackageJson,
  getMonorepoReadme,
  getMonorepoWebPackageJson,
  getPythonServiceMain,
  getPythonServicePyproject,
  getPythonServiceReadme,
  getPythonServiceRoutes,
  getPythonServiceTests,
  getRustLibraryAssemblyCue,
  getRustLibraryCargoToml,
  getRustLibraryReadme,
  getRustLibrarySrc,
  getRustLibraryTests,
  getServiceAssemblyCue,
  getTypescriptConfig,
  getTypescriptLibraryPackageJson,
  getTypescriptLibraryReadme,
  getTypescriptLibrarySrc,
  getTypescriptLibraryTests,
  getTypescriptLibraryTypes,
  minimizeContent,
} from "@/services/examples/templates.js";
import {
  type PackageManagerCommandSet,
  detectPackageManager,
  getPackageManagerCommands,
} from "@/utils/io/package-manager.js";
import chalk from "chalk";

/**
 * Options for examples command
 */
export interface ExamplesOptions {
  type?: "profile" | "language";
  profile?: string;
  language?: string;
  output?: string;
  minimal?: boolean;
  complete?: boolean;
}

/**
 * Example project templates
 */
interface ExampleTemplate {
  name: string;
  description: string;
  type: "profile" | "language";
  tags: string[];
  files: Record<string, ExampleTemplateFile>;
  structure: string[];
}

type ExampleTemplateFile = string | ((context: ExampleTemplateContext) => string);

interface ExampleTemplateContext {
  packageManager: PackageManagerCommandSet;
}

/**
 * Validate the example type parameter.
 */
function isValidExampleType(type: string): type is "profile" | "language" {
  return ["profile", "language"].includes(type);
}

/**
 * Filter templates by profile or language options.
 */
function filterTemplatesByOptions(
  templates: ExampleTemplate[],
  options: ExamplesOptions,
): ExampleTemplate[] {
  let result = templates;

  if (options.profile) {
    result = result.filter((t) => t.name === options.profile || t.tags.includes(options.profile!));
  }

  if (options.language) {
    result = result.filter((t) => t.tags.includes(options.language!));
  }

  return result;
}

/**
 * Display available templates when no matches found.
 */
function showAvailableTemplates(templates: ExampleTemplate[]): void {
  console.log(chalk.yellow("No matching examples found"));
  console.log(chalk.dim("Available examples:"));
  for (const template of templates) {
    console.log(chalk.dim(`  ${template.name} (${template.tags.join(", ")})`));
  }
}

/**
 * Display next steps after generation.
 */
function showNextSteps(outputDir: string): void {
  console.log(chalk.blue("\n🎯 Next steps:"));
  console.log(chalk.dim(`  📁 Browse examples: cd ${outputDir}`));
  console.log(chalk.dim("  🏃 Try an example: cd <example-dir> && arbiter init"));
  console.log(chalk.dim("  📚 Learn more: arbiter docs schema --examples"));
}

function handleInvalidType(type: string): number {
  console.error(chalk.red(`Invalid type: ${type}`));
  console.log(chalk.dim("Valid types: profile, language"));
  return 1;
}

async function setupOutputDirectory(options: ExamplesOptions): Promise<string> {
  const outputDir = options.output || "./examples";
  await fs.mkdir(outputDir, { recursive: true });
  console.log(chalk.green(`✅ Created output directory: ${outputDir}`));
  return outputDir;
}

function setupPackageManagerContext(): PackageManagerCommandSet {
  const packageManager = detectPackageManager();
  console.log(chalk.dim(`Using ${packageManager} commands for install/run instructions`));
  return getPackageManagerCommands(packageManager);
}

function resolveTemplatesToGenerate(
  type: string,
  options: ExamplesOptions,
): { templates: ExampleTemplate[]; filtered: ExampleTemplate[] } | null {
  const templates = getExampleTemplates();
  const filtered = templates.filter((t) => t.type === type);

  if (filtered.length === 0) {
    console.log(chalk.yellow(`No examples available for type: ${type}`));
    return null;
  }

  return { templates, filtered };
}

/**
 * Generate example projects by profile or language type
 */
export async function examplesCommand(
  type: string,
  options: ExamplesOptions,
  _config: Config,
): Promise<number> {
  try {
    console.log(chalk.blue("🏗️  Generating example projects..."));

    if (!isValidExampleType(type)) return handleInvalidType(type);

    const outputDir = await setupOutputDirectory(options);
    const pmCommands = setupPackageManagerContext();

    const templateResult = resolveTemplatesToGenerate(type, options);
    if (!templateResult) return 1;

    const templatesToGenerate = filterTemplatesByOptions(templateResult.filtered, options);
    if (templatesToGenerate.length === 0) {
      showAvailableTemplates(templateResult.filtered);
      return 1;
    }

    for (const template of templatesToGenerate) {
      await generateExampleProject(template, outputDir, options, pmCommands);
    }

    showNextSteps(outputDir);
    return 0;
  } catch (error) {
    console.error(
      chalk.red("Example generation failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 2;
  }
}

/**
 * Get all available example templates
 */
function getExampleTemplates(): ExampleTemplate[] {
  return [
    {
      name: "typescript-library",
      description: "TypeScript library with comprehensive tooling",
      type: "profile",
      tags: ["typescript", "library", "npm", "testing"],
      structure: [
        "src/",
        "src/index.ts",
        "src/types.ts",
        "test/",
        "test/index.test.ts",
        "package.json",
        "tsconfig.json",
        "arbiter.assembly.cue",
      ],
      files: {
        "package.json": getTypescriptLibraryPackageJson(),
        "tsconfig.json": getTypescriptConfig(),
        "src/index.ts": getTypescriptLibrarySrc(),
        "src/types.ts": getTypescriptLibraryTypes(),
        "test/index.test.ts": getTypescriptLibraryTests(),
        "arbiter.assembly.cue": getLibraryAssemblyCue(),
        "README.md": (ctx) => getTypescriptLibraryReadme(ctx.packageManager),
      },
    },
    {
      name: "typescript-cli",
      description: "TypeScript CLI tool with argument parsing",
      type: "profile",
      tags: ["typescript", "cli", "commander", "testing"],
      structure: [
        "src/",
        "src/cli.ts",
        "src/commands/",
        "bin/",
        "test/",
        "package.json",
        "arbiter.assembly.cue",
      ],
      files: {
        "package.json": getCliPackageJson(),
        "src/cli.ts": getCliSrc(),
        "src/commands/hello.ts": getCliHelloCommand(),
        "bin/cli.js": getCliBin(),
        "test/cli.test.ts": getCliTests(),
        "arbiter.assembly.cue": getCliAssemblyCue(),
        "README.md": (ctx) => getCliReadme(ctx.packageManager),
      },
    },
    {
      name: "python-service",
      description: "Python FastAPI service with async patterns",
      type: "profile",
      tags: ["python", "service", "fastapi", "async"],
      structure: [
        "src/",
        "src/main.py",
        "src/api/",
        "tests/",
        "pyproject.toml",
        "arbiter.assembly.cue",
      ],
      files: {
        "pyproject.toml": getPythonServicePyproject(),
        "src/main.py": getPythonServiceMain(),
        "src/api/routes.py": getPythonServiceRoutes(),
        "tests/test_main.py": getPythonServiceTests(),
        "arbiter.assembly.cue": getServiceAssemblyCue(),
        "README.md": getPythonServiceReadme(),
      },
    },
    {
      name: "rust-library",
      description: "Rust library with zero-cost abstractions",
      type: "profile",
      tags: ["rust", "library", "performance", "safety"],
      structure: ["src/", "src/lib.rs", "tests/", "Cargo.toml", "arbiter.assembly.cue"],
      files: {
        "Cargo.toml": getRustLibraryCargoToml(),
        "src/lib.rs": getRustLibrarySrc(),
        "tests/integration_test.rs": getRustLibraryTests(),
        "arbiter.assembly.cue": getRustLibraryAssemblyCue(),
        "README.md": getRustLibraryReadme(),
      },
    },
    {
      name: "go-microservice",
      description: "Go microservice with concurrency patterns",
      type: "profile",
      tags: ["go", "service", "microservice", "concurrency"],
      structure: ["cmd/", "cmd/server/", "internal/", "pkg/", "go.mod", "arbiter.assembly.cue"],
      files: {
        "go.mod": getGoServiceGoMod(),
        "cmd/server/main.go": getGoServiceMain(),
        "internal/handlers/health.go": getGoServiceHandlers(),
        "pkg/config/config.go": getGoServiceConfig(),
        "arbiter.assembly.cue": getGoServiceAssemblyCue(),
        "README.md": getGoServiceReadme(),
      },
    },
    {
      name: "typescript-monorepo",
      description: "Multi-package TypeScript monorepo setup",
      type: "language",
      tags: ["typescript", "monorepo", "workspaces", "lerna"],
      structure: [
        "packages/",
        "packages/core/",
        "packages/cli/",
        "packages/web/",
        "package.json",
        "arbiter.assembly.cue",
      ],
      files: {
        "package.json": getMonorepoPackageJson(),
        "packages/core/package.json": getMonorepoCorePackageJson(),
        "packages/cli/package.json": getMonorepoCliPackageJson(),
        "packages/web/package.json": getMonorepoWebPackageJson(),
        "arbiter.assembly.cue": getMonorepoAssemblyCue(),
        "README.md": getMonorepoReadme(),
      },
    },
  ];
}

/**
 * Generate a single example project
 */
async function generateExampleProject(
  template: ExampleTemplate,
  outputDir: string,
  options: ExamplesOptions,
  packageManager: PackageManagerCommandSet,
): Promise<void> {
  const projectDir = path.join(outputDir, template.name);

  console.log(chalk.blue(`📦 Generating ${template.name}...`));
  console.log(chalk.dim(`   ${template.description}`));

  await fs.mkdir(projectDir, { recursive: true });

  for (const dir of template.structure.filter((s) => s.endsWith("/"))) {
    await fs.mkdir(path.join(projectDir, dir), { recursive: true });
  }

  const context: ExampleTemplateContext = { packageManager };

  for (const [filePath, content] of Object.entries(template.files)) {
    let fileContent = typeof content === "function" ? content(context) : content;

    if (options.minimal) {
      fileContent = minimizeContent(fileContent);
    } else if (options.complete) {
      fileContent = expandContent(fileContent, template.name);
    }

    const fullPath = path.join(projectDir, filePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    await safeFileOperation("write", fullPath, async (validatedPath) => {
      await fs.writeFile(validatedPath, fileContent, "utf-8");
    });
  }

  console.log(chalk.green(`   ✅ Generated at: ${projectDir}`));
}

/**
 * Library config interface for processor
 */
export interface LibraryConfig {
  readonly name: string;
  readonly version: string;
  readonly features?: readonly string[];
}

/**
 * Example processor class
 */
export class ExampleProcessor {
  private readonly config: LibraryConfig;

  constructor(config: LibraryConfig) {
    this.config = config;
  }

  async process(input: string): Promise<string> {
    return `Processed: ${input}`;
  }

  getConfig(): LibraryConfig {
    return { ...this.config };
  }
}

/**
 * Create a new processor instance
 */
export function createProcessor(config: LibraryConfig): ExampleProcessor {
  return new ExampleProcessor(config);
}

/**
 * Type guard for validated input
 */
export function isValidatedInput(
  input: string,
): input is string & { readonly __brand: "ValidatedInput" } {
  return input.length > 0 && input.length <= 1000;
}

/**
 * Hello command options
 */
export interface HelloOptions {
  uppercase?: boolean;
  count?: string;
}

/**
 * Hello command implementation
 */
export async function helloCommand(
  name: string | undefined,
  options: HelloOptions,
): Promise<number> {
  const greeting = `Hello, ${name || "World"}!`;
  const count = parseInt(options.count || "1", 10);

  if (isNaN(count) || count <= 0) {
    console.error(chalk.red("Count must be a positive number"));
    return 1;
  }

  for (let i = 0; i < count; i++) {
    const message = options.uppercase ? greeting.toUpperCase() : greeting;
    console.log(chalk.green(message));
  }

  return 0;
}
