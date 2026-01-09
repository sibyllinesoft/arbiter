/**
 * @packageDocumentation
 * Surface command - Extract API surfaces from source code.
 *
 * Provides functionality to:
 * - Extract public APIs from TypeScript, Go, Python, and Rust code
 * - Calculate surface deltas between versions
 * - Output in table, JSON, or YAML format
 * - Support glob patterns for file matching
 */

import type { CLIConfig } from "@/types.js";
import type { SurfaceOutput } from "@/types/output.js";
import { withStepProgress } from "@/utils/api/progress.js";
import { resolveSmartNaming } from "@/utils/util/core/smart-naming.js";
import { createOutputManager } from "@/utils/util/output/standardized-output.js";
import chalk from "chalk";
import { glob } from "glob";

import { calculateSurfaceDelta } from "@/surface-extraction/delta.js";
import { getExtractor } from "@/surface-extraction/index.js";
import type { APISurface, APISymbol, SurfaceOptions } from "@/surface-extraction/types.js";

export type { APISurface } from "@/surface-extraction/types.js";

// Progress step helper to reduce code duplication
function advanceStep(progress: any, message: string): void {
  if ("nextStep" in progress) {
    progress.nextStep(message);
  } else {
    progress.log(message);
  }
}

function failStep(progress: any, message: string): void {
  if ("failCurrentStep" in progress) {
    progress.failCurrentStep(message);
  } else {
    progress.error(message);
  }
}

function displayStatistics(surface: APISurface, delta: any): void {
  console.log(chalk.cyan("\nStatistics:"));
  console.log(`  Total symbols: ${surface.statistics.totalSymbols}`);
  console.log(`  Public symbols: ${surface.statistics.publicSymbols}`);
  console.log(`  Private symbols: ${surface.statistics.privateSymbols}`);

  for (const [type, count] of Object.entries(surface.statistics.byType)) {
    console.log(`  ${type}: ${count}`);
  }

  if (delta) {
    console.log(chalk.yellow("\n⚠️  API changes detected:"));
    if (delta.added > 0) console.log(chalk.green(`  + ${delta.added} added symbols`));
    if (delta.removed > 0) console.log(chalk.red(`  - ${delta.removed} removed symbols`));
    if (delta.breaking) {
      console.log(
        chalk.red(`  🚨 Breaking changes detected - ${delta.requiredBump} bump recommended`),
      );
    }
  }
}

function mapSymbolsForOutput(symbols: APISymbol[]): any[] {
  return symbols.map((s) => ({
    name: s.name,
    type: s.type,
    visibility: s.visibility,
    signature: s.signature,
    location: s.location,
  }));
}

/**
 * Build surface output structure.
 */
function buildSurfaceOutput(
  options: SurfaceOptions,
  surface: APISurface,
  delta: any,
): SurfaceOutput {
  return {
    apiVersion: "arbiter.dev/v2",
    timestamp: Date.now(),
    command: "surface",
    kind: "Surface",
    language: options.language,
    surface: { symbols: mapSymbolsForOutput(surface.symbols), statistics: surface.statistics },
    delta,
  };
}

/**
 * Log project info in non-agent mode.
 */
function logProjectInfo(namingResult: { context: { name: string }; filename: string }): void {
  if (namingResult.context.name) {
    console.log(chalk.dim(`   Project: ${namingResult.context.name}`));
    console.log(chalk.dim(`   Output: ${namingResult.filename}`));
  }
}

/**
 * Execute the surface extraction pipeline steps.
 */
async function executeSurfacePipeline(
  options: SurfaceOptions,
  progress: any,
  outputManager: ReturnType<typeof createOutputManager>,
  agentMode: boolean,
): Promise<number> {
  // Step 1: Resolve smart naming
  advanceStep(progress, "Resolving project configuration");
  const namingResult = await resolveSmartNaming("surface", {
    output: options.output,
    outputDir: options.outputDir,
    projectName: options.projectName,
    useGenericNames: options.genericNames ?? false,
  });

  outputManager.emitEvent({
    phase: "surface",
    status: "start",
    data: {
      language: options.language,
      outputFile: namingResult.filename,
      projectName: namingResult.context.name,
    },
  });

  if (!agentMode) logProjectInfo(namingResult);

  // Step 2: Scan source files
  advanceStep(progress, "Scanning source files");
  const sourceFiles = await findSourceFiles(options.language);

  if (sourceFiles.length === 0) {
    failStep(progress, `No ${options.language} files found`);
    return 1;
  }

  // Step 3-4: Analyze and extract
  advanceStep(progress, `Analyzing code structure (${sourceFiles.length} files)`);
  advanceStep(progress, "Extracting API symbols");
  const surface = await extractAPISurface(options, sourceFiles);

  if (!surface) {
    failStep(progress, "Failed to extract API surface");
    outputManager.emitEvent({
      phase: "surface",
      status: "error",
      error: "Failed to extract API surface",
    });
    return 1;
  }

  // Step 5: Generate surface definition
  advanceStep(progress, "Generating surface definition");
  const delta = options.diff
    ? await calculateSurfaceDelta(surface, namingResult.fullPath)
    : undefined;
  const surfaceOutput = buildSurfaceOutput(options, surface, delta);

  // Step 6: Write output
  advanceStep(progress, "Writing output file");
  await outputManager.writeSurfaceFile(surfaceOutput, namingResult.fullPath);

  if (!agentMode) displayStatistics(surface, delta);

  outputManager.emitEvent({
    phase: "surface",
    status: "complete",
    data: { symbols: surface.statistics.totalSymbols, delta },
  });
  return 0;
}

/**
 * Surface command implementation
 * Extracts API surface from source code and generates surface.json for diff analysis
 */
export async function surfaceCommand(options: SurfaceOptions, _config: CLIConfig): Promise<number> {
  const agentMode = false;
  const outputManager = createOutputManager("surface", agentMode);

  const steps = [
    "Resolving project configuration",
    "Scanning source files",
    "Analyzing code structure",
    "Extracting API symbols",
    "Generating surface definition",
    "Writing output file",
  ];

  return withStepProgress(
    { title: `Extracting ${options.language} API surface`, steps, color: "blue" },
    async (progress) => {
      try {
        const result = await executeSurfacePipeline(options, progress, outputManager, agentMode);
        outputManager.close();
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!agentMode) console.error(chalk.red("❌ Surface command failed:"), errorMessage);
        outputManager.emitEvent({ phase: "surface", status: "error", error: errorMessage });
        outputManager.close();
        return 1;
      }
    },
  );
}

/**
 * Find source files for the specified language
 */
export async function findSourceFiles(language: string): Promise<string[]> {
  const patterns: Record<string, string[]> = {
    typescript: ["**/*.ts", "**/*.tsx"],
    python: ["**/*.py"],
    rust: ["**/*.rs"],
    go: ["**/*.go"],
    bash: ["**/*.sh", "**/*.bash"],
  };

  const ignorePatterns = [
    "node_modules/**",
    "dist/**",
    "build/**",
    "target/**",
    "**/*.test.*",
    "**/*.spec.*",
    "**/*_test.*",
    "**/__tests__/**",
    "**/.git/**",
  ];

  const files = await glob(patterns[language] || [], {
    ignore: ignorePatterns,
  });

  return files;
}

/**
 * Extract API surface based on language
 */
export async function extractAPISurface(
  options: SurfaceOptions,
  sourceFiles: string[],
): Promise<APISurface | null> {
  const extractor = getExtractor(options.language);
  if (extractor) {
    return extractor(options, sourceFiles);
  }

  switch (options.language) {
    default:
      throw new Error(`Unsupported language: ${options.language}`);
  }
}

/**
 * Calculate surface delta between current and previous versions
 */
