#!/usr/bin/env bun

/**
 * Unified Documentation Orchestration System
 *
 * Coordinates all documentation generation types for the Arbiter project:
 * - CLI documentation generation
 * - CUE schema documentation generation
 * - Code generation system documentation
 * - API documentation from OpenAPI specs
 * - Overall project documentation
 */

import { spawn } from "child_process";
import * as path from "path";
import { promisify } from "util";
import chalk from "chalk";
import { program } from "commander";
import * as fs from "fs-extra";
import { glob } from "glob";
import YAML from "yaml";

const execAsync = promisify(spawn);

interface DocumentationConfig {
  version: string;
  enabled: boolean;
  pipeline: {
    cli: DocTypeConfig;
    cue: DocTypeConfig;
    api: DocTypeConfig;
    codegen: DocTypeConfig;
    project: DocTypeConfig;
  };
  outputs: {
    baseDir: string;
    formats: string[];
    staging?: string;
    production?: string;
  };
  validation: {
    enabled: boolean;
    failOnError: boolean;
    coverage: {
      minimum: number;
      target: number;
    };
    quality: {
      linkCheck: boolean;
      spellCheck: boolean;
      accessibility: boolean;
    };
  };
  deployment: {
    enabled: boolean;
    target: "github-pages" | "vercel" | "custom";
    customCommand?: string;
    preDeployHooks: string[];
    postDeployHooks: string[];
  };
  monitoring: {
    enabled: boolean;
    freshness: {
      maxAgeHours: number;
      alertThreshold: number;
    };
    metrics: {
      coverage: boolean;
      brokenLinks: boolean;
      generateTime: boolean;
    };
  };
  git: {
    autoCommit: boolean;
    commitMessage: string;
    branch?: string;
    createPR?: boolean;
  };
}

interface DocTypeConfig {
  enabled: boolean;
  command: string;
  args: string[];
  workingDir?: string;
  dependencies: string[];
  outputs: string[];
  timeout: number;
  retries: number;
  parallel: boolean;
  priority: number;
}

interface OrchestrationOptions {
  config?: string;
  types?: string;
  "dry-run"?: boolean;
  "fail-fast"?: boolean;
  parallel?: boolean;
  "skip-validation"?: boolean;
  "skip-deployment"?: boolean;
  "force-regenerate"?: boolean;
  verbose?: boolean;
  watch?: boolean;
  environment?: "dev" | "staging" | "production";
}

interface DocumentationResult {
  type: string;
  success: boolean;
  duration: number;
  outputFiles: string[];
  warnings: string[];
  errors: string[];
  metrics?: {
    coverage?: number;
    brokenLinks?: number;
    quality?: number;
  };
}

interface PipelineResult {
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  results: DocumentationResult[];
  overallSuccess: boolean;
  coverage: number;
  qualityScore: number;
  deploymentStatus?: {
    deployed: boolean;
    url?: string;
    error?: string;
  };
}

/**
 * Main orchestration command
 */
export async function main(): Promise<void> {
  program
    .name("docs-orchestrator")
    .description("Unified documentation pipeline orchestration")
    .version("1.0.0")
    .option("-c, --config <path>", "configuration file path", "./docs/config/docs-config.yaml")
    .option("-t, --types <types>", "documentation types to generate (comma-separated)", "all")
    .option("--dry-run", "preview operations without executing")
    .option("--fail-fast", "stop on first error")
    .option("--parallel", "run compatible generators in parallel")
    .option("--skip-validation", "skip documentation validation")
    .option("--skip-deployment", "skip deployment phase")
    .option("--force-regenerate", "force regeneration even if docs are fresh")
    .option("-v, --verbose", "verbose output")
    .option("-w, --watch", "watch mode for development")
    .option("-e, --environment <env>", "environment: dev|staging|production", "dev")
    .action(async (options: OrchestrationOptions) => {
      try {
        const exitCode = await runDocumentationPipeline(options);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Documentation pipeline failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  program
    .command("init")
    .description("initialize documentation configuration")
    .option("--template <name>", "configuration template", "default")
    .action(async (options) => {
      try {
        await initializeConfiguration(options.template);
        console.log(chalk.green("✅ Documentation configuration initialized"));
      } catch (error) {
        console.error(chalk.red("Failed to initialize configuration:"), error);
        process.exit(1);
      }
    });

  program
    .command("status")
    .description("check documentation pipeline status")
    .option("-c, --config <path>", "configuration file path", "./docs/config/docs-config.yaml")
    .action(async (options) => {
      try {
        await showPipelineStatus(options.config);
      } catch (error) {
        console.error(chalk.red("Failed to show status:"), error);
        process.exit(1);
      }
    });

  program
    .command("validate")
    .description("validate documentation quality and completeness")
    .option("-c, --config <path>", "configuration file path", "./docs/config/docs-config.yaml")
    .option("--fix", "attempt to fix issues automatically")
    .action(async (options) => {
      try {
        const exitCode = await validateDocumentation(options.config, options.fix);
        process.exit(exitCode);
      } catch (error) {
        console.error(chalk.red("Documentation validation failed:"), error);
        process.exit(1);
      }
    });

  program.parse();
}

/**
 * Run the complete documentation pipeline
 */
async function runDocumentationPipeline(options: OrchestrationOptions): Promise<number> {
  const startTime = new Date();

  console.log(chalk.blue("🚀 Starting Unified Documentation Pipeline"));
  console.log(chalk.dim(`Environment: ${options.environment}`));
  console.log(chalk.dim(`Started: ${startTime.toISOString()}`));

  // Load configuration
  const config = await loadConfiguration(options.config);

  if (!config.enabled) {
    console.log(chalk.yellow("⏭️  Documentation pipeline disabled in configuration"));
    return 0;
  }

  // Determine types to generate
  const typesToGenerate = getTypesToGenerate(options.types || "all", config);

  if (options.verbose) {
    console.log(chalk.dim("Configuration:"));
    console.log(chalk.dim(JSON.stringify(config, null, 2)));
    console.log(chalk.dim(`Types to generate: ${typesToGenerate.join(", ")}`));
  }

  // Check freshness (unless force regenerate)
  if (!options["force-regenerate"]) {
    const staleTypes = await checkDocumentationFreshness(config, typesToGenerate);
    if (staleTypes.length === 0) {
      console.log(chalk.green("✅ All documentation is up to date"));
      return 0;
    }
    console.log(chalk.yellow(`📅 Stale documentation types: ${staleTypes.join(", ")}`));
  }

  // Execute pipeline phases
  const result = await executePipeline(config, typesToGenerate, options);

  // Print summary
  printPipelineResult(result);

  // Handle deployment
  if (!options["skip-deployment"] && config.deployment.enabled) {
    console.log(chalk.blue("🚀 Deploying documentation..."));
    result.deploymentStatus = await deployDocumentation(config, result);
  }

  // Handle git operations
  if (config.git.autoCommit && result.overallSuccess && !options["dry-run"]) {
    await commitDocumentationChanges(config, result);
  }

  // Start watch mode if requested
  if (options.watch) {
    await startWatchMode(config, options);
  }

  return result.overallSuccess ? 0 : 1;
}

/**
 * Execute the documentation pipeline
 */
async function executePipeline(
  config: DocumentationConfig,
  types: string[],
  options: OrchestrationOptions,
): Promise<PipelineResult> {
  const startTime = new Date();
  const results: DocumentationResult[] = [];

  // Sort types by priority and dependencies
  const orderedTypes = sortTypesByDependencies(types, config);

  console.log(chalk.blue("📋 Execution Plan:"));
  for (let i = 0; i < orderedTypes.length; i++) {
    console.log(chalk.dim(`  ${i + 1}. ${orderedTypes[i]}`));
  }

  // Execute each documentation type
  if (options.parallel && canRunInParallel(orderedTypes, config)) {
    console.log(chalk.blue("⚡ Running generators in parallel..."));
    const promises = orderedTypes.map((type) => generateDocumentationType(type, config, options));
    const parallelResults = await Promise.allSettled(promises);

    for (let i = 0; i < parallelResults.length; i++) {
      const result = parallelResults[i];
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          type: orderedTypes[i],
          success: false,
          duration: 0,
          outputFiles: [],
          warnings: [],
          errors: [result.reason?.message || "Unknown error"],
        });
      }
    }
  } else {
    // Sequential execution
    for (const type of orderedTypes) {
      const result = await generateDocumentationType(type, config, options);
      results.push(result);

      if (!result.success && options["fail-fast"]) {
        console.error(
          chalk.red(`❌ Failed to generate ${type} documentation, stopping due to --fail-fast`),
        );
        break;
      }
    }
  }

  // Run validation if enabled
  let overallSuccess = results.every((r) => r.success);
  let coverage = 0;
  let qualityScore = 0;

  if (!options["skip-validation"] && config.validation.enabled) {
    console.log(chalk.blue("✅ Running validation..."));
    const validationResult = await runValidation(config, results);
    coverage = validationResult.coverage;
    qualityScore = validationResult.qualityScore;

    if (!validationResult.success && config.validation.failOnError) {
      overallSuccess = false;
    }
  }

  const endTime = new Date();

  return {
    startTime,
    endTime,
    totalDuration: endTime.getTime() - startTime.getTime(),
    results,
    overallSuccess,
    coverage,
    qualityScore,
  };
}

/**
 * Generate documentation for a specific type
 */
async function generateDocumentationType(
  type: string,
  config: DocumentationConfig,
  options: OrchestrationOptions,
): Promise<DocumentationResult> {
  const typeConfig = config.pipeline[type as keyof typeof config.pipeline];
  const startTime = Date.now();

  console.log(chalk.blue(`📄 Generating ${type} documentation...`));

  if (!typeConfig.enabled) {
    console.log(chalk.yellow(`⏭️  ${type} documentation disabled`));
    return {
      type,
      success: true,
      duration: Date.now() - startTime,
      outputFiles: [],
      warnings: ["Documentation type disabled"],
      errors: [],
    };
  }

  try {
    // Check dependencies
    for (const dep of typeConfig.dependencies) {
      const depExists = await fs.pathExists(dep);
      if (!depExists) {
        throw new Error(`Dependency not found: ${dep}`);
      }
    }

    // Prepare command
    const args = [...typeConfig.args];
    if (options["dry-run"]) args.push("--dry-run");
    if (options.verbose) args.push("--verbose");

    if (options["dry-run"]) {
      console.log(chalk.yellow(`🔍 Would execute: ${typeConfig.command} ${args.join(" ")}`));
      return {
        type,
        success: true,
        duration: Date.now() - startTime,
        outputFiles: typeConfig.outputs,
        warnings: [],
        errors: [],
      };
    }

    // Execute command
    const result = await executeCommand(
      typeConfig.command,
      args,
      typeConfig.workingDir || process.cwd(),
      typeConfig.timeout,
    );

    // Verify outputs were created
    const outputFiles: string[] = [];
    const warnings: string[] = [];

    for (const output of typeConfig.outputs) {
      const files = await glob(output);
      if (files.length === 0) {
        warnings.push(`Expected output not found: ${output}`);
      } else {
        outputFiles.push(...files);
      }
    }

    console.log(chalk.green(`  ✅ ${type} completed (${outputFiles.length} files)`));

    return {
      type,
      success: result.exitCode === 0,
      duration: Date.now() - startTime,
      outputFiles,
      warnings,
      errors: result.exitCode !== 0 ? [result.stderr] : [],
    };
  } catch (error) {
    console.error(
      chalk.red(`  ❌ ${type} failed: ${error instanceof Error ? error.message : String(error)}`),
    );

    return {
      type,
      success: false,
      duration: Date.now() - startTime,
      outputFiles: [],
      warnings: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Execute a command with timeout and capture output
 */
async function executeCommand(
  command: string,
  args: string[],
  cwd: string,
  timeout: number = 30000,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Command timeout after ${timeout}ms`));
    }, timeout);

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode: exitCode || 0, stdout, stderr });
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * Load configuration from file
 */
async function loadConfiguration(configPath?: string): Promise<DocumentationConfig> {
  const defaultConfig: DocumentationConfig = {
    version: "1.0.0",
    enabled: true,
    pipeline: {
      cli: {
        enabled: true,
        command: "bun",
        args: ["run", "docs:cli"],
        dependencies: ["./packages/cli/dist"],
        outputs: ["./docs/cli-reference.*"],
        timeout: 60000,
        retries: 2,
        parallel: true,
        priority: 1,
      },
      cue: {
        enabled: true,
        command: "bun",
        args: ["run", "docs:cue"],
        dependencies: ["./packages/shared/src/cue"],
        outputs: ["./docs/cue-schemas.*"],
        timeout: 30000,
        retries: 1,
        parallel: true,
        priority: 2,
      },
      api: {
        enabled: true,
        command: "bun",
        args: ["run", "docs:api"],
        dependencies: ["./apps/api/src"],
        outputs: ["./docs/api-reference.*"],
        timeout: 45000,
        retries: 2,
        parallel: true,
        priority: 3,
      },
      codegen: {
        enabled: true,
        command: "bun",
        args: ["run", "docs:codegen"],
        dependencies: ["./packages/cli/src/commands/generate.ts"],
        outputs: ["./docs/code-generation.*"],
        timeout: 30000,
        retries: 1,
        parallel: true,
        priority: 4,
      },
      project: {
        enabled: true,
        command: "bun",
        args: ["run", "docs:project"],
        dependencies: ["./README.md", "./CLAUDE.md"],
        outputs: ["./docs/project-overview.*"],
        timeout: 15000,
        retries: 1,
        parallel: false,
        priority: 5,
      },
    },
    outputs: {
      baseDir: "./docs",
      formats: ["markdown", "html", "json"],
    },
    validation: {
      enabled: true,
      failOnError: false,
      coverage: {
        minimum: 80,
        target: 95,
      },
      quality: {
        linkCheck: true,
        spellCheck: false,
        accessibility: true,
      },
    },
    deployment: {
      enabled: false,
      target: "github-pages",
      preDeployHooks: [],
      postDeployHooks: [],
    },
    monitoring: {
      enabled: true,
      freshness: {
        maxAgeHours: 24,
        alertThreshold: 72,
      },
      metrics: {
        coverage: true,
        brokenLinks: true,
        generateTime: true,
      },
    },
    git: {
      autoCommit: false,
      commitMessage: "docs: update documentation [automated]",
    },
  };

  if (!configPath || !(await fs.pathExists(configPath))) {
    console.log(chalk.dim("Using default configuration"));
    return defaultConfig;
  }

  try {
    const configContent = await fs.readFile(configPath, "utf8");
    const userConfig =
      configPath.endsWith(".yaml") || configPath.endsWith(".yml")
        ? YAML.parse(configContent)
        : JSON.parse(configContent);

    return { ...defaultConfig, ...userConfig };
  } catch (error) {
    console.warn(chalk.yellow(`Failed to load config from ${configPath}, using defaults`));
    return defaultConfig;
  }
}

/**
 * Helper functions for pipeline execution
 */

function getTypesToGenerate(types: string, config: DocumentationConfig): string[] {
  if (types === "all") {
    return Object.keys(config.pipeline).filter(
      (type) => config.pipeline[type as keyof typeof config.pipeline].enabled,
    );
  }
  return types.split(",").map((t) => t.trim());
}

function sortTypesByDependencies(types: string[], config: DocumentationConfig): string[] {
  return types.sort((a, b) => {
    const aConfig = config.pipeline[a as keyof typeof config.pipeline];
    const bConfig = config.pipeline[b as keyof typeof config.pipeline];
    return aConfig.priority - bConfig.priority;
  });
}

function canRunInParallel(types: string[], config: DocumentationConfig): boolean {
  return types.every((type) => config.pipeline[type as keyof typeof config.pipeline].parallel);
}

async function checkDocumentationFreshness(
  config: DocumentationConfig,
  types: string[],
): Promise<string[]> {
  const staleTypes: string[] = [];
  const maxAge = config.monitoring.freshness.maxAgeHours * 60 * 60 * 1000; // Convert to ms

  for (const type of types) {
    const typeConfig = config.pipeline[type as keyof typeof config.pipeline];
    let isStale = false;

    for (const output of typeConfig.outputs) {
      const files = await glob(output);
      for (const file of files) {
        try {
          const stats = await fs.stat(file);
          const age = Date.now() - stats.mtime.getTime();
          if (age > maxAge) {
            isStale = true;
            break;
          }
        } catch {
          isStale = true;
          break;
        }
      }
      if (isStale) break;
    }

    if (isStale) {
      staleTypes.push(type);
    }
  }

  return staleTypes;
}

async function runValidation(
  config: DocumentationConfig,
  results: DocumentationResult[],
): Promise<{
  success: boolean;
  coverage: number;
  qualityScore: number;
}> {
  let coverage = 0;
  let qualityScore = 0;
  let success = true;

  // Calculate coverage
  const totalExpected = results.length;
  const successful = results.filter((r) => r.success).length;
  coverage = (successful / totalExpected) * 100;

  // Check if coverage meets minimum
  if (coverage < config.validation.coverage.minimum) {
    console.log(
      chalk.red(
        `❌ Coverage ${coverage.toFixed(1)}% below minimum ${config.validation.coverage.minimum}%`,
      ),
    );
    success = false;
  }

  // Calculate quality score (placeholder - could be enhanced)
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  qualityScore = Math.max(0, 100 - totalWarnings * 2 - totalErrors * 10);

  console.log(chalk.blue(`📊 Validation Results:`));
  console.log(chalk.dim(`  Coverage: ${coverage.toFixed(1)}%`));
  console.log(chalk.dim(`  Quality Score: ${qualityScore.toFixed(1)}`));

  return { success, coverage, qualityScore };
}

async function deployDocumentation(
  config: DocumentationConfig,
  result: PipelineResult,
): Promise<{
  deployed: boolean;
  url?: string;
  error?: string;
}> {
  try {
    // Run pre-deploy hooks
    for (const hook of config.deployment.preDeployHooks) {
      await executeCommand("sh", ["-c", hook], process.cwd(), 30000);
    }

    // Deploy based on target
    let deployResult;
    switch (config.deployment.target) {
      case "github-pages":
        deployResult = await deployToGitHubPages();
        break;
      case "vercel":
        deployResult = await deployToVercel();
        break;
      case "custom":
        if (config.deployment.customCommand) {
          await executeCommand("sh", ["-c", config.deployment.customCommand], process.cwd(), 60000);
        }
        deployResult = { deployed: true };
        break;
      default:
        throw new Error(`Unsupported deployment target: ${config.deployment.target}`);
    }

    // Run post-deploy hooks
    for (const hook of config.deployment.postDeployHooks) {
      await executeCommand("sh", ["-c", hook], process.cwd(), 30000);
    }

    return deployResult;
  } catch (error) {
    return {
      deployed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function deployToGitHubPages(): Promise<{ deployed: boolean; url?: string }> {
  // Placeholder implementation
  console.log(chalk.blue("📤 Deploying to GitHub Pages..."));
  return { deployed: true, url: "https://username.github.io/arbiter" };
}

async function deployToVercel(): Promise<{ deployed: boolean; url?: string }> {
  // Placeholder implementation
  console.log(chalk.blue("📤 Deploying to Vercel..."));
  return { deployed: true, url: "https://arbiter-docs.vercel.app" };
}

async function commitDocumentationChanges(
  config: DocumentationConfig,
  result: PipelineResult,
): Promise<void> {
  try {
    // Check if there are changes
    const statusResult = await executeCommand(
      "git",
      ["status", "--porcelain", config.outputs.baseDir],
      process.cwd(),
    );
    if (statusResult.stdout.trim() === "") {
      console.log(chalk.dim("No documentation changes to commit"));
      return;
    }

    // Add changes
    await executeCommand("git", ["add", config.outputs.baseDir], process.cwd());

    // Create commit
    const commitMessage = `${config.git.commitMessage} [${result.results.map((r) => r.type).join(", ")}]`;
    await executeCommand("git", ["commit", "-m", commitMessage], process.cwd());

    console.log(chalk.green(`✅ Committed documentation changes: ${commitMessage}`));
  } catch (error) {
    console.error(chalk.red("Git commit failed:"), error);
  }
}

async function startWatchMode(
  config: DocumentationConfig,
  options: OrchestrationOptions,
): Promise<void> {
  console.log(chalk.blue("👀 Starting watch mode..."));

  const chokidar = await import("chokidar");

  const watchPaths = [
    "./packages/*/src/**/*.ts",
    "./apps/*/src/**/*.ts",
    "./docs/**/*.md",
    "./*.md",
  ];

  const watcher = chokidar.watch(watchPaths, {
    ignored: /node_modules|\.git/,
    persistent: true,
  });

  let isGenerating = false;

  watcher.on("change", async (filePath) => {
    if (isGenerating) return;

    console.log(chalk.blue(`📁 File changed: ${filePath}`));
    console.log(chalk.blue("🔄 Regenerating documentation..."));

    isGenerating = true;

    try {
      await runDocumentationPipeline({ ...options, watch: false });
      console.log(chalk.green("✅ Documentation updated"));
    } catch (error) {
      console.error(chalk.red("Documentation generation failed:"), error);
    } finally {
      isGenerating = false;
    }
  });

  console.log(chalk.green("👀 Watching for file changes..."));
  console.log(chalk.dim("Press Ctrl+C to stop"));

  // Keep the process running
  return new Promise(() => {});
}

function printPipelineResult(result: PipelineResult): void {
  console.log(chalk.blue("\n📊 Pipeline Results:"));
  console.log(chalk.dim(`Duration: ${result.totalDuration}ms`));
  console.log(chalk.dim(`Success: ${result.overallSuccess ? "Yes" : "No"}`));
  console.log(chalk.dim(`Coverage: ${result.coverage.toFixed(1)}%`));
  console.log(chalk.dim(`Quality Score: ${result.qualityScore.toFixed(1)}`));

  for (const docResult of result.results) {
    const icon = docResult.success ? "✅" : "❌";
    const duration = `${docResult.duration}ms`;
    console.log(
      chalk.dim(
        `  ${icon} ${docResult.type} (${duration}) - ${docResult.outputFiles.length} files`,
      ),
    );

    if (docResult.warnings.length > 0) {
      for (const warning of docResult.warnings) {
        console.log(chalk.yellow(`    ⚠️  ${warning}`));
      }
    }

    if (docResult.errors.length > 0) {
      for (const error of docResult.errors) {
        console.log(chalk.red(`    ❌ ${error}`));
      }
    }
  }
}

async function initializeConfiguration(template: string): Promise<void> {
  const configPath = "./docs/config/docs-config.yaml";
  const config = await loadConfiguration(); // Get default config

  const yamlContent = YAML.stringify(config, {
    indent: 2,
    lineWidth: -1,
  });

  await fs.writeFile(configPath, yamlContent, "utf8");
  console.log(chalk.green(`Configuration written to ${configPath}`));
}

async function showPipelineStatus(configPath?: string): Promise<void> {
  const config = await loadConfiguration(configPath);

  console.log(chalk.blue("📋 Documentation Pipeline Status:"));
  console.log(chalk.dim(`Enabled: ${config.enabled ? "Yes" : "No"}`));
  console.log(chalk.dim(`Base Directory: ${config.outputs.baseDir}`));
  console.log(chalk.dim(`Formats: ${config.outputs.formats.join(", ")}`));

  console.log(chalk.blue("\n📄 Documentation Types:"));
  for (const [type, typeConfig] of Object.entries(config.pipeline)) {
    const status = typeConfig.enabled ? chalk.green("✅") : chalk.red("❌");
    console.log(`  ${status} ${type} - ${typeConfig.command} ${typeConfig.args.join(" ")}`);
  }

  // Check freshness
  const types = Object.keys(config.pipeline).filter(
    (type) => config.pipeline[type as keyof typeof config.pipeline].enabled,
  );
  const staleTypes = await checkDocumentationFreshness(config, types);

  if (staleTypes.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Stale documentation: ${staleTypes.join(", ")}`));
  } else {
    console.log(chalk.green("\n✅ All documentation is fresh"));
  }
}

async function validateDocumentation(configPath?: string, fix?: boolean): Promise<number> {
  const config = await loadConfiguration(configPath);

  console.log(chalk.blue("🔍 Validating documentation..."));

  // Placeholder validation logic
  const issues: string[] = [];

  // Check if output directory exists
  const outputExists = await fs.pathExists(config.outputs.baseDir);
  if (!outputExists) {
    issues.push(`Output directory does not exist: ${config.outputs.baseDir}`);
  }

  // Check for expected output files
  for (const [type, typeConfig] of Object.entries(config.pipeline)) {
    if (!typeConfig.enabled) continue;

    for (const output of typeConfig.outputs) {
      const files = await glob(output);
      if (files.length === 0) {
        issues.push(`Missing output for ${type}: ${output}`);
      }
    }
  }

  if (issues.length > 0) {
    console.log(chalk.red("❌ Validation failed:"));
    for (const issue of issues) {
      console.log(chalk.red(`  - ${issue}`));
    }

    if (fix) {
      console.log(chalk.blue("🔧 Attempting to fix issues..."));
      // Placeholder fix logic
      await fs.ensureDir(config.outputs.baseDir);
      console.log(chalk.green("✅ Created missing output directory"));
    }

    return config.validation.failOnError ? 1 : 0;
  }

  console.log(chalk.green("✅ Documentation validation passed"));
  return 0;
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red("Script error:"), error);
    process.exit(1);
  });
}
