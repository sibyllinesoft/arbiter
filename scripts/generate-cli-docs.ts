#!/usr/bin/env bun

/**
 * CLI Documentation Build Script
 *
 * Integrates with the build process to automatically generate and update CLI documentation.
 * Can be run standalone or as part of CI/CD pipelines.
 */

import { spawn } from "child_process";
import * as path from "path";
import { promisify } from "util";
import chalk from "chalk";
import { program } from "commander";
import * as fs from "fs-extra";

const execAsync = promisify(spawn);

interface BuildConfig {
  enabled: boolean;
  outputDir: string;
  formats: string[];
  failOnError: boolean;
  watch?: boolean;
  git?: {
    autoCommit: boolean;
    commitMessage: string;
    targetBranch?: string;
  };
}

interface BuildOptions {
  config?: string;
  formats?: string;
  output?: string;
  watch?: boolean;
  "auto-commit"?: boolean;
  "commit-message"?: string;
  "fail-on-error"?: boolean;
  verbose?: boolean;
  "dry-run"?: boolean;
}

/**
 * Main build script
 */
async function main() {
  program
    .name("generate-cli-docs")
    .description("Generate CLI documentation for build integration")
    .version("1.0.0")
    .option("-c, --config <path>", "configuration file path", "./docs.config.json")
    .option("-f, --formats <formats>", "documentation formats to generate", "markdown,html,json")
    .option("-o, --output <dir>", "output directory", "./docs")
    .option("-w, --watch", "watch mode for development")
    .option("--auto-commit", "automatically commit generated docs")
    .option("--commit-message <message>", "git commit message", "docs: update CLI reference")
    .option("--fail-on-error", "fail build on documentation errors")
    .option("--verbose", "verbose output")
    .option("--dry-run", "preview what would be generated")
    .action(async (options: BuildOptions) => {
      try {
        const exitCode = await generateDocumentation(options);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Build script failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  program.parse();
}

/**
 * Generate documentation with build integration
 */
async function generateDocumentation(options: BuildOptions): Promise<number> {
  console.log(chalk.blue("🔧 CLI Documentation Build Integration"));

  // Load configuration
  const config = await loadBuildConfig(options.config);

  // Override config with CLI options
  if (options.formats) config.formats = options.formats.split(",");
  if (options.output) config.outputDir = options.output;
  if (options["fail-on-error"] !== undefined) config.failOnError = options["fail-on-error"];
  if (options.watch) config.watch = options.watch;
  if (options["auto-commit"]) {
    config.git = config.git || { autoCommit: false, commitMessage: "" };
    config.git.autoCommit = true;
  }
  if (options["commit-message"]) {
    config.git = config.git || { autoCommit: false, commitMessage: "" };
    config.git.commitMessage = options["commit-message"];
  }

  if (!config.enabled) {
    console.log(chalk.yellow("⏭️  Documentation generation disabled in configuration"));
    return 0;
  }

  if (options.verbose) {
    console.log(chalk.dim("Configuration:"));
    console.log(chalk.dim(JSON.stringify(config, null, 2)));
  }

  // Check if CLI is built
  const cliPath = path.resolve("./packages/cli/dist/cli.js");
  if (!(await fs.pathExists(cliPath))) {
    console.log(chalk.blue("🔨 Building CLI first..."));
    const buildResult = await buildCLI();
    if (buildResult !== 0) {
      console.error(chalk.red("CLI build failed"));
      return config.failOnError ? 1 : 0;
    }
  }

  // Generate documentation
  const result = await runDocGeneration(config, options);

  if (result !== 0) {
    if (config.failOnError) {
      console.error(chalk.red("Documentation generation failed and failOnError is enabled"));
      return 1;
    } else {
      console.log(chalk.yellow("Documentation generation failed but continuing..."));
    }
  }

  // Handle git operations
  if (config.git?.autoCommit && !options["dry-run"]) {
    console.log(chalk.blue("📝 Committing documentation changes..."));
    const commitResult = await commitDocumentation(config);
    if (commitResult !== 0) {
      console.warn(chalk.yellow("Failed to commit documentation changes"));
    }
  }

  // Watch mode
  if (config.watch) {
    console.log(chalk.blue("👀 Watching for changes..."));
    await startWatchMode(config, options);
  }

  return result;
}

/**
 * Load build configuration
 */
async function loadBuildConfig(configPath?: string): Promise<BuildConfig> {
  const defaultConfig: BuildConfig = {
    enabled: true,
    outputDir: "./docs",
    formats: ["markdown", "html", "json"],
    failOnError: false,
    git: {
      autoCommit: false,
      commitMessage: "docs: update CLI reference",
    },
  };

  if (!configPath || !(await fs.pathExists(configPath))) {
    console.log(chalk.dim("Using default configuration"));
    return defaultConfig;
  }

  try {
    const config = await fs.readJSON(configPath);
    return { ...defaultConfig, ...config };
  } catch (error) {
    console.warn(chalk.yellow(`Failed to load config from ${configPath}, using defaults`));
    return defaultConfig;
  }
}

/**
 * Build the CLI package
 */
async function buildCLI(): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("bun", ["run", "build"], {
      cwd: path.resolve("./packages/cli"),
      stdio: "inherit",
    });

    child.on("close", (code) => {
      resolve(code || 0);
    });

    child.on("error", (error) => {
      console.error(chalk.red("Build process error:"), error);
      resolve(1);
    });
  });
}

/**
 * Run documentation generation
 */
async function runDocGeneration(config: BuildConfig, options: BuildOptions): Promise<number> {
  return new Promise((resolve) => {
    const args = [
      "run",
      "tsx",
      "./packages/cli/src/commands/docs-generate.ts",
      "--formats",
      config.formats.join(","),
      "--output",
      config.outputDir,
      "--toc",
      "--search",
      "--validate",
    ];

    if (options["dry-run"]) args.push("--dry-run");
    if (options.verbose) args.push("--verbose");

    console.log(chalk.blue("🚀 Running documentation generation..."));
    if (options.verbose) {
      console.log(chalk.dim(`Command: bun ${args.join(" ")}`));
    }

    const child = spawn("bun", args, {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    child.on("close", (code) => {
      resolve(code || 0);
    });

    child.on("error", (error) => {
      console.error(chalk.red("Documentation generation error:"), error);
      resolve(1);
    });
  });
}

/**
 * Commit documentation changes
 */
async function commitDocumentation(config: BuildConfig): Promise<number> {
  if (!config.git?.autoCommit) return 0;

  try {
    // Check if there are changes
    const statusResult = await runGitCommand(["status", "--porcelain", config.outputDir]);
    if (statusResult.stdout.trim() === "") {
      console.log(chalk.dim("No documentation changes to commit"));
      return 0;
    }

    // Add changes
    await runGitCommand(["add", config.outputDir]);

    // Create commit
    const commitMessage = config.git.commitMessage || "docs: update CLI reference";
    await runGitCommand(["commit", "-m", commitMessage]);

    console.log(chalk.green(`✅ Committed documentation changes: ${commitMessage}`));
    return 0;
  } catch (error) {
    console.error(chalk.red("Git commit failed:"), error);
    return 1;
  }
}

/**
 * Run git command
 */
async function runGitCommand(
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Git command failed with code ${code}: ${stderr}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Start watch mode
 */
async function startWatchMode(config: BuildConfig, options: BuildOptions): Promise<void> {
  const chokidar = await import("chokidar");

  const watcher = chokidar.watch(["./packages/cli/src/**/*.ts", "./packages/cli/src/**/*.js"], {
    ignored: /node_modules/,
    persistent: true,
  });

  let isGenerating = false;

  watcher.on("change", async (filePath) => {
    if (isGenerating) return;

    console.log(chalk.blue(`📁 File changed: ${filePath}`));
    console.log(chalk.blue("🔄 Regenerating documentation..."));

    isGenerating = true;

    try {
      await runDocGeneration(config, options);
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

/**
 * Create example configuration file
 */
async function createExampleConfig(): Promise<void> {
  const exampleConfig: BuildConfig = {
    enabled: true,
    outputDir: "./docs",
    formats: ["markdown", "html", "json"],
    failOnError: false,
    watch: false,
    git: {
      autoCommit: false,
      commitMessage: "docs: update CLI reference [automated]",
      targetBranch: "main",
    },
  };

  await fs.writeFile("./docs.config.json", JSON.stringify(exampleConfig, null, 2), "utf8");

  console.log(chalk.green("✅ Created example configuration: docs.config.json"));
}

// Additional command to create config
program
  .command("init-config")
  .description("create example documentation configuration")
  .action(async () => {
    try {
      await createExampleConfig();
      console.log(
        chalk.blue("Edit docs.config.json to customize your documentation build settings."),
      );
    } catch (error) {
      console.error(chalk.red("Failed to create config:"), error);
      process.exit(1);
    }
  });

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red("Script error:"), error);
    process.exit(1);
  });
}
