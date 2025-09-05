import { readFile } from "node:fs/promises";
import chalk from "chalk";
import { ApiClient } from "../api-client.js";
import type { CLIConfig } from "../types.js";
import { FileWatcher, type WatchBatch } from "../utils/file-watcher.js";
import { createOutputManager, shouldUseAgentMode } from "../utils/standardized-output.js";

export interface WatchOptions {
  /** Path to watch (default: current directory) */
  path?: string;
  /** Enable agent mode (NDJSON output) */
  agentMode?: boolean;
  /** Output NDJSON to file instead of stdout */
  ndjsonOutput?: string;
  /** Debounce delay in milliseconds */
  debounce?: number;
  /** Custom patterns to watch */
  patterns?: string[];
  /** Run validation pipeline on changes */
  validate?: boolean;
  /** Run planning pipeline on changes */
  plan?: boolean;
}

/**
 * Watch command implementation
 * Monitors files and runs validation/planning pipelines according to the spec
 */
export async function watchCommand(options: WatchOptions, config: CLIConfig): Promise<number> {
  const watchPath = options.path || ".";
  const agentMode = shouldUseAgentMode(options);
  const debounce = options.debounce || 300;

  // Create output manager
  const outputManager = createOutputManager("watch", agentMode, options.ndjsonOutput);

  try {
    const apiClient = new ApiClient(config);

    // Test API connection first
    const healthResult = await apiClient.health();
    if (!healthResult.success) {
      if (agentMode) {
        outputManager.emitEvent({
          phase: "watch",
          status: "error",
          data: {
            message: `API server unavailable: ${healthResult.error}`,
            error: "connection_failed",
          },
        });
      } else {
        console.error(chalk.red("❌ API server unavailable:"), healthResult.error);
        console.error(chalk.dim("Make sure the Arbiter server is running"));
      }
      return 1;
    }

    // Emit watch start event
    outputManager.emitEvent({
      phase: "watch",
      status: "start",
      data: {
        path: watchPath,
        debounce,
        patterns: options.patterns || [
          "**/*.cue",
          "**/arbiter.assembly.cue",
          "**/*.json",
          "**/*.yaml",
          "**/*.yml",
          "**/*.ts",
          "**/*.js",
          "**/*.py",
          "**/*.rs",
          "**/*.go",
        ],
      },
    });

    if (!agentMode) {
      console.log(chalk.green("✅ Connected to Arbiter API"));
      console.log(chalk.blue(`🔍 Starting file watcher for: ${watchPath}`));
      console.log(chalk.dim(`Debounce: ${debounce}ms | Agent mode: ${agentMode}`));
    }

    const watcher = new FileWatcher({
      paths: [watchPath],
      debounce,
      agentMode,
      patterns: options.patterns || [
        "**/*.cue",
        "**/arbiter.assembly.cue",
        "**/*.json",
        "**/*.yaml",
        "**/*.yml",
        "**/*.ts",
        "**/*.js",
        "**/*.py",
        "**/*.rs",
        "**/*.go",
      ],
    });

    // Set up graceful shutdown
    const cleanup = async () => {
      if (agentMode) {
        outputManager.emitEvent({
          phase: "watch",
          status: "complete",
          data: { reason: "shutdown_requested" },
        });
      } else {
        console.log(chalk.yellow("\n🛑 Shutting down file watcher..."));
      }
      await watcher.stop();
      outputManager.close();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Start watching with batch processing
    await watcher.start(async (batch: WatchBatch) => {
      await processBatch(batch, apiClient, options, config, outputManager);
    });

    // Keep the process running
    return new Promise<number>(() => {
      // Never resolve - this runs indefinitely until interrupted
    });
  } catch (error) {
    if (agentMode) {
      outputManager.emitEvent({
        phase: "watch",
        status: "error",
        data: {
          message: `Watch command failed: ${error instanceof Error ? error.message : String(error)}`,
          error: "watch_failed",
        },
      });
    } else {
      console.error(
        chalk.red("❌ Watch command failed:"),
        error instanceof Error ? error.message : String(error),
      );
    }
    outputManager.close();
    return 1;
  }
}

/**
 * Process a batch of file change events
 */
async function processBatch(
  batch: WatchBatch,
  apiClient: ApiClient,
  options: WatchOptions,
  _config: CLIConfig,
  outputManager: StandardizedOutputManager,
): Promise<void> {
  const agentMode = shouldUseAgentMode(options);

  // Get changed file paths for event data
  const changedFiles = batch.events
    .filter((e) => e.type !== "unlink" && e.type !== "unlinkDir")
    .map((e) => e.path);

  // Emit watch change event
  outputManager.emitEvent({
    phase: "watch",
    status: "change",
    data: {
      changed: changedFiles,
      eventCount: batch.events.length,
      debounceWindow: batch.debounceWindow,
    },
  });

  if (!agentMode) {
    console.log(chalk.cyan(`\n📝 Processing ${batch.events.length} file changes...`));
  }

  // Group events by file type for efficient processing
  const cueFiles: string[] = [];
  const otherFiles: string[] = [];

  for (const event of batch.events) {
    if (event.type === "unlink" || event.type === "unlinkDir") {
      continue; // Skip deleted files
    }

    if (event.path.endsWith(".cue")) {
      cueFiles.push(event.path);
    } else {
      otherFiles.push(event.path);
    }
  }

  let validateResult: any = null;
  let surfaceResult: any = null;
  let planResult: any = null;

  // Process CUE files first (validation)
  if (cueFiles.length > 0 && options.validate !== false) {
    validateResult = await validateFiles(cueFiles, apiClient, agentMode);
  }

  // Run planning if requested and assembly file changed
  const assemblyChanged = batch.events.some(
    (e) => e.path.includes("arbiter.assembly.cue") && e.type !== "unlink",
  );

  if (assemblyChanged && options.plan) {
    planResult = await runPlanning(apiClient, agentMode);
  }

  // Surface analysis for code files
  const codeFiles = otherFiles.filter((f) => /\.(ts|js|py|rs|go)$/.test(f));

  if (codeFiles.length > 0) {
    surfaceResult = await analyzeSurface(codeFiles, agentMode);
  }

  // Emit final watch event with results
  outputManager.emitEvent({
    phase: "watch",
    status: "complete",
    data: {
      changed: changedFiles,
      validate: validateResult,
      surface: surfaceResult,
      gates: planResult,
      processedFiles: {
        cue: cueFiles.length,
        code: codeFiles.length,
        other: otherFiles.length - codeFiles.length,
      },
    },
  });

  if (!agentMode) {
    console.log(chalk.green("✅ Batch processing complete"));
  }
}

/**
 * Validate CUE files
 */
async function validateFiles(
  files: string[],
  apiClient: ApiClient,
  agentMode: boolean,
): Promise<{ valid: number; invalid: number; errors: string[] }> {
  const results = { valid: 0, invalid: 0, errors: [] as string[] };

  for (const file of files) {
    try {
      const content = await readFile(file, "utf-8");
      const result = await apiClient.validate(content);

      if (result.success) {
        results.valid++;
        if (!agentMode) {
          console.log(chalk.green(`  ✅ ${file} - Valid`));
        }
      } else {
        results.invalid++;
        const error = `${file}: ${result.error || "Validation failed"}`;
        results.errors.push(error);

        if (!agentMode) {
          console.log(chalk.red(`  ❌ ${file} - ${result.error || "Validation failed"}`));
          if (result.data?.errors) {
            result.data.errors.forEach((error) => {
              console.log(chalk.red(`     ${error}`));
            });
          }
        }
      }
    } catch (error) {
      results.invalid++;
      const errorMsg = `${file}: Read error - ${error instanceof Error ? error.message : String(error)}`;
      results.errors.push(errorMsg);

      if (!agentMode) {
        console.log(
          chalk.red(
            `  ❌ ${file} - Read error: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }
  }

  return results;
}

/**
 * Run planning pipeline
 */
async function runPlanning(
  _apiClient: ApiClient,
  agentMode: boolean,
): Promise<{ status: string; message: string }> {
  if (!agentMode) {
    console.log(chalk.blue("  📋 Running planning pipeline..."));
  }

  // This would integrate with the planning API when available
  // For now, just return the status
  const result = {
    status: "not_implemented",
    message: "Planning pipeline not yet implemented",
  };

  if (!agentMode) {
    console.log(chalk.yellow("  ⚠️  Planning pipeline not yet implemented"));
  }

  return result;
}

/**
 * Analyze API surface of code files
 */
async function analyzeSurface(
  files: string[],
  agentMode: boolean,
): Promise<{ status: string; message: string; files: number }> {
  if (!agentMode) {
    console.log(chalk.blue(`  🔍 Analyzing API surface for ${files.length} code files...`));
  }

  // This would integrate with the surface analysis when implemented
  // For now, just return the status
  const result = {
    status: "not_implemented",
    message: "Surface analysis not yet implemented",
    files: files.length,
  };

  if (!agentMode) {
    console.log(chalk.yellow("  ⚠️  Surface analysis not yet implemented"));
  }

  return result;
}
