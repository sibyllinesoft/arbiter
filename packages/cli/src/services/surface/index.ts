import chalk from "chalk";
import { glob } from "glob";
import type { CLIConfig } from "../../types.js";
import type { SurfaceOutput } from "../../types/output.js";
import { withStepProgress } from "../../utils/progress.js";
import { resolveSmartNaming } from "../../utils/smart-naming.js";
import { createOutputManager, shouldUseAgentMode } from "../../utils/standardized-output.js";

import { calculateSurfaceDelta } from "../../surface-extraction/delta.js";
import { getExtractor } from "../../surface-extraction/index.js";
import type { APISurface, APISymbol, SurfaceOptions } from "../../surface-extraction/types.js";

export type { APISurface } from "../../surface-extraction/types.js";

/**
 * Surface command implementation
 * Extracts API surface from source code and generates surface.json for diff analysis
 */
export async function surfaceCommand(options: SurfaceOptions, _config: CLIConfig): Promise<number> {
  const agentMode = shouldUseAgentMode(options);
  const outputManager = createOutputManager("surface", agentMode, options.ndjsonOutput);

  // Define the steps for surface extraction
  const steps = [
    "Resolving project configuration",
    "Scanning source files",
    "Analyzing code structure",
    "Extracting API symbols",
    "Generating surface definition",
    "Writing output file",
  ];

  return withStepProgress(
    {
      title: `Extracting ${options.language} API surface`,
      steps,
      color: "blue",
    },
    async (progress) => {
      try {
        // Step 1: Resolve smart naming for output file
        if ("nextStep" in progress) {
          progress.nextStep("Resolving project configuration");
        } else {
          progress.log("Resolving project configuration");
        }
        const namingResult = await resolveSmartNaming("surface", {
          output: options.output,
          outputDir: options.outputDir,
          projectName: options.projectName,
          useGenericNames: options.genericNames ?? false,
        });

        // Emit start event for agent mode
        outputManager.emitEvent({
          phase: "surface",
          status: "start",
          data: {
            language: options.language,
            outputFile: namingResult.filename,
            projectName: namingResult.context.name,
          },
        });

        if (!agentMode && namingResult.context.name) {
          console.log(chalk.dim(`   Project: ${namingResult.context.name}`));
          console.log(chalk.dim(`   Output: ${namingResult.filename}`));
        }

        // Step 2: Scan source files
        if ("nextStep" in progress) {
          progress.nextStep("Scanning source files");
        } else {
          progress.log("Scanning source files");
        }
        const sourceFiles = await findSourceFiles(options.language);

        if (sourceFiles.length === 0) {
          if ("failCurrentStep" in progress) {
            progress.failCurrentStep(`No ${options.language} files found`);
          } else {
            progress.error(`No ${options.language} files found`);
          }
          return 1;
        }

        // Step 3: Analyze code structure
        if ("nextStep" in progress) {
          progress.nextStep(`Analyzing code structure (${sourceFiles.length} files)`);
        } else {
          progress.log(`Analyzing code structure (${sourceFiles.length} files)`);
        }

        // Step 4: Extract API symbols
        if ("nextStep" in progress) {
          progress.nextStep("Extracting API symbols");
        } else {
          progress.log("Extracting API symbols");
        }
        const surface = await extractAPISurface(options, sourceFiles);

        if (!surface) {
          if ("failCurrentStep" in progress) {
            progress.failCurrentStep("Failed to extract API surface");
          } else {
            progress.error("Failed to extract API surface");
          }
          outputManager.emitEvent({
            phase: "surface",
            status: "error",
            error: "Failed to extract API surface",
          });
          return 1;
        }

        // Step 5: Generate surface definition and calculate delta if requested
        if ("nextStep" in progress) {
          progress.nextStep("Generating surface definition");
        } else {
          progress.log("Generating surface definition");
        }
        let delta;
        if (options.diff) {
          delta = await calculateSurfaceDelta(surface, namingResult.fullPath);
        }

        // Create standardized surface output
        const surfaceOutput: SurfaceOutput = {
          apiVersion: "arbiter.dev/v2",
          timestamp: Date.now(),
          command: "surface",
          kind: "Surface",
          language: options.language,
          surface: {
            symbols: surface.symbols.map((s) => ({
              name: s.name,
              type: s.type,
              visibility: s.visibility,
              signature: s.signature,
              location: s.location,
            })),
            statistics: surface.statistics,
          },
          delta,
        };

        // Step 6: Write output file
        if ("nextStep" in progress) {
          progress.nextStep("Writing output file");
        } else {
          progress.log("Writing output file");
        }
        await outputManager.writeSurfaceFile(surfaceOutput, namingResult.fullPath);

        if (!agentMode) {
          console.log(chalk.cyan("\nStatistics:"));
          console.log(`  Total symbols: ${surface.statistics.totalSymbols}`);
          console.log(`  Public symbols: ${surface.statistics.publicSymbols}`);
          console.log(`  Private symbols: ${surface.statistics.privateSymbols}`);

          // Show breakdown by type
          for (const [type, count] of Object.entries(surface.statistics.byType)) {
            console.log(`  ${type}: ${count}`);
          }

          if (delta) {
            console.log(chalk.yellow("\n⚠️  API changes detected:"));
            if (delta.added > 0) {
              console.log(chalk.green(`  + ${delta.added} added symbols`));
            }
            if (delta.removed > 0) {
              console.log(chalk.red(`  - ${delta.removed} removed symbols`));
            }
            if (delta.breaking) {
              console.log(
                chalk.red(
                  `  🚨 Breaking changes detected - ${delta.requiredBump} bump recommended`,
                ),
              );
            }
          }
        }

        // Emit completion event
        outputManager.emitEvent({
          phase: "surface",
          status: "complete",
          data: {
            symbols: surface.statistics.totalSymbols,
            delta,
          },
        });

        outputManager.close();
        return 0;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (!agentMode) {
          console.error(chalk.red("❌ Surface command failed:"), errorMessage);
        }

        outputManager.emitEvent({
          phase: "surface",
          status: "error",
          error: errorMessage,
        });

        outputManager.close();
        return 1;
      }
    },
  );
}

/**
 * Find source files for the specified language
 */
async function findSourceFiles(language: string): Promise<string[]> {
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
async function extractAPISurface(
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
