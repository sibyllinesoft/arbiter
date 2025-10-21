import path from "node:path";
import { translateCueErrors } from "@arbiter/shared";
import chalk from "chalk";
import fs from "fs-extra";
import { glob } from "glob";
import { ApiClient } from "../api-client.js";
import { ConstraintViolationError, getGlobalConstraintSystem } from "../constraints/index.js";
import { validateCUE } from "../cue/index.js";
import type { CLIConfig, CheckOptions, ValidationResult } from "../types.js";
import {
  formatErrorDetails,
  formatFileSize,
  formatJson,
  formatSummary,
  formatValidationTable,
  formatWarningDetails,
} from "../utils/formatting.js";
import { withProgress } from "../utils/progress.js";

/**
 * Enhanced check command with comprehensive constraint enforcement
 * Implements all "Don'ts" from TODO.md section 13
 */
export async function checkCommandConstrained(
  patterns: string[],
  options: CheckOptions,
  config: CLIConfig,
): Promise<number> {
  const constraintSystem = getGlobalConstraintSystem();

  try {
    return await constraintSystem.executeWithConstraints(
      "check",
      {
        sandbox: "check",
        filesystem: "read",
        idempotent: "validate",
      },
      async () => {
        // Use default pattern if none provided
        if (patterns.length === 0) {
          patterns = ["**/*.cue"];
        }

        // Find all matching files with constraint validation
        const files = await findCueFilesConstrained(patterns, {
          recursive: options.recursive ?? true,
          cwd: config.projectDir,
        });

        if (files.length === 0) {
          console.log(chalk.yellow("No CUE files found"));
          return 0;
        }

        console.log(chalk.dim(`Found ${files.length} CUE files`));

        // Validate files with full constraint enforcement
        const results = await validateFilesConstrained(files, config, options);

        // Format and display results
        if (options.format === "json") {
          const output = formatJson(results, config.color);
          // Validate JSON output payload size
          constraintSystem.validateApiResponse(output);
          console.log(output);
        } else {
          displayResultsConstrained(results, options, config);
        }

        // Generate constraint compliance report if verbose
        if (options.verbose) {
          console.log(`\n${constraintSystem.generateComplianceReport()}`);
        }

        // Determine exit code
        const hasErrors = results.some((r) => r.status === "invalid" || r.status === "error");
        return hasErrors ? 1 : 0;
      },
      {
        patterns: patterns.length,
        recursive: options.recursive,
        format: options.format,
      },
    );
  } catch (error) {
    if (error instanceof ConstraintViolationError) {
      console.error(chalk.red("Constraint violation:"), error.message);
      console.error(chalk.dim("Details:"), JSON.stringify(error.details, null, 2));
      return 2; // Constraint violation exit code
    }

    console.error(
      chalk.red("Check command failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 2;
  }
}

/**
 * Find CUE files with file system constraint validation
 */
async function findCueFilesConstrained(
  patterns: string[],
  options: {
    recursive: boolean;
    cwd: string;
  },
): Promise<string[]> {
  const constraintSystem = getGlobalConstraintSystem();

  // Validate working directory path
  await constraintSystem.validateFileOperation("read", [options.cwd]);

  const allFiles: string[] = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: options.cwd,
      absolute: true,
      ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
    });

    // Validate each found file path
    await constraintSystem.validateFileOperation("read", files);

    allFiles.push(...files);
  }

  // Remove duplicates and sort
  return [...new Set(allFiles)].sort();
}

/**
 * Validate multiple files with comprehensive constraint enforcement
 */
async function validateFilesConstrained(
  files: string[],
  config: CLIConfig,
  options: CheckOptions,
): Promise<ValidationResult[]> {
  const constraintSystem = getGlobalConstraintSystem();
  const useLocalOnly = config.localMode === true;
  const apiClient = useLocalOnly ? null : new ApiClient(config);
  const results: ValidationResult[] = [];

  if (!useLocalOnly) {
    const healthCheck = await apiClient!.health();
    if (!healthCheck.success) {
      throw new Error(`Cannot connect to Arbiter server: ${healthCheck.error}`);
    }
  }

  let _processedCount = 0;
  const progressText = `Validating ${files.length} files${useLocalOnly ? " locally" : ""}...`;

  return withProgress({ text: progressText, color: "blue" }, async () => {
    // Process files with constrained concurrency (respects rate limiting)
    const concurrency = 1; // Keep sequential processing for deterministic output
    const chunks = chunkArray(files, concurrency);

    for (const chunk of chunks) {
      const chunkResults: ValidationResult[] = [];

      // Process chunk sequentially to respect rate limits
      for (const file of chunk) {
        try {
          const result = useLocalOnly
            ? await validateFileConstrainedLocally(file, options, constraintSystem)
            : await validateFileConstrained(file, apiClient!, options, constraintSystem);
          chunkResults.push(result);
          _processedCount++;

          if (options.verbose) {
            const status =
              result.status === "valid"
                ? chalk.green("✓")
                : result.status === "invalid"
                  ? chalk.red("✗")
                  : chalk.yellow("!");
            console.log(`${status} ${path.relative(config.projectDir, file)}`);
          }

          if (!useLocalOnly) {
            // Enforce rate limiting between requests
            await new Promise((resolve) => setTimeout(resolve, 1100));
          }
        } catch (error) {
          if (error instanceof ConstraintViolationError) {
            console.error(
              chalk.red(`Constraint violation in ${path.basename(file)}:`),
              error.message,
            );

            // Create error result for constraint violations
            chunkResults.push({
              file: path.basename(file),
              status: "error",
              errors: [
                {
                  line: 0,
                  column: 0,
                  message: `Constraint violation: ${error.constraint} - ${error.message}`,
                  severity: "error" as const,
                  category: "constraint",
                },
              ],
              warnings: [],
              processingTime: 0,
            });
          } else {
            throw error;
          }
        }
      }

      results.push(...chunkResults);

      // Fail fast if requested and we have errors
      if (options.failFast && chunkResults.some((r) => r.status !== "valid")) {
        break;
      }
    }

    return results;
  });
}

/**
 * Validate a single file with comprehensive constraint enforcement
 */
async function validateFileConstrained(
  filePath: string,
  apiClient: ApiClient,
  _options: CheckOptions,
  constraintSystem: ReturnType<typeof getGlobalConstraintSystem>,
): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    // Validate file path constraints
    await constraintSystem.validateFileOperation("read", [filePath]);

    // Check if file exists and is readable
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return {
        file: path.basename(filePath),
        status: "error",
        errors: [
          {
            line: 0,
            column: 0,
            message: "Not a file",
            severity: "error" as const,
            category: "system",
          },
        ],
        warnings: [],
        processingTime: Date.now() - startTime,
      };
    }

    // Enforce payload size limit (64 KB)
    const maxSize = 64 * 1024; // 64 KB constraint
    if (stats.size > maxSize) {
      return {
        file: path.basename(filePath),
        status: "error",
        errors: [
          {
            line: 0,
            column: 0,
            message: `File too large (${formatFileSize(stats.size)}), maximum allowed: ${formatFileSize(maxSize)}`,
            severity: "error" as const,
            category: "constraint",
          },
        ],
        warnings: [],
        processingTime: Date.now() - startTime,
      };
    }

    // Read file content
    const content = await fs.readFile(filePath, "utf-8");

    // Validate content payload size
    constraintSystem.validateApiResponse(content);

    // Validate using API (sandbox compliant)
    const validationResult = await apiClient.validate(content);

    // Validate API response constraints
    const _validatedResponse = constraintSystem.validateApiResponse(validationResult);

    if (!validationResult.success || !validationResult.data) {
      return {
        file: path.basename(filePath),
        status: "error",
        errors: [
          {
            line: 0,
            column: 0,
            message: validationResult.error || "Unknown validation error",
            severity: "error" as const,
            category: "api",
          },
        ],
        warnings: [],
        processingTime: Date.now() - startTime,
      };
    }

    const data = validationResult.data;

    // Process errors with enhanced translation
    const errors =
      data.errors?.map((error) => {
        const translated = translateCueErrors(error.message);
        return {
          line: error.line || 0,
          column: error.column || 0,
          message: translated[0]?.friendlyMessage || error.message,
          severity: "error" as const,
          category: translated[0]?.category || "validation",
        };
      }) || [];

    // Process warnings
    const warnings =
      data.warnings?.map((warning) => ({
        line: warning.line || 0,
        column: warning.column || 0,
        message: warning.message,
        category: "validation",
      })) || [];

    const status = data.success ? "valid" : "invalid";
    const processingTime = Date.now() - startTime;

    // Enforce operation time constraint (≤750 ms)
    if (processingTime > 750) {
      console.warn(
        chalk.yellow(
          `Warning: ${path.basename(filePath)} took ${processingTime}ms (>750ms constraint)`,
        ),
      );
    }

    return {
      file: path.basename(filePath),
      status,
      errors,
      warnings,
      processingTime,
    };
  } catch (error) {
    if (error instanceof ConstraintViolationError) {
      throw error; // Let constraint violations bubble up
    }

    return {
      file: path.basename(filePath),
      status: "error",
      errors: [
        {
          line: 0,
          column: 0,
          message: error instanceof Error ? error.message : String(error),
          severity: "error" as const,
          category: "system",
        },
      ],
      warnings: [],
      processingTime: Date.now() - startTime,
    };
  }
}

async function validateFileConstrainedLocally(
  filePath: string,
  _options: CheckOptions,
  constraintSystem: ReturnType<typeof getGlobalConstraintSystem>,
): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    await constraintSystem.validateFileOperation("read", [filePath]);

    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return buildConstraintErrorResult(filePath, "Not a file", "system", startTime);
    }

    const maxSize = 64 * 1024;
    if (stats.size > maxSize) {
      return buildConstraintErrorResult(
        filePath,
        `File too large (${formatFileSize(stats.size)}), maximum allowed: ${formatFileSize(maxSize)}`,
        "constraint",
        startTime,
      );
    }

    const content = await fs.readFile(filePath, "utf-8");
    constraintSystem.validateApiResponse(content);

    const validation = await validateCUE(content);
    if (validation.valid) {
      return {
        file: path.basename(filePath),
        status: "valid",
        errors: [],
        warnings: [],
        processingTime: Date.now() - startTime,
      };
    }

    const errors =
      validation.errors.map((message) => {
        const translated = translateCueErrors(message);
        return {
          line: 0,
          column: 0,
          message: translated[0]?.friendlyMessage || message,
          severity: "error" as const,
          category: translated[0]?.category || "validation",
        };
      }) || [];

    return {
      file: path.basename(filePath),
      status: "invalid",
      errors,
      warnings: [],
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildConstraintErrorResult(filePath, message, "system", startTime);
  }
}

function buildConstraintErrorResult(
  filePath: string,
  message: string,
  category: string,
  startTime: number,
): ValidationResult {
  return {
    file: path.basename(filePath),
    status: "error",
    errors: [
      {
        line: 0,
        column: 0,
        message,
        severity: "error",
        category,
      },
    ],
    warnings: [],
    processingTime: Date.now() - startTime,
  };
}

/**
 * Display validation results with constraint compliance information
 */
function displayResultsConstrained(
  results: ValidationResult[],
  options: CheckOptions,
  _config: CLIConfig,
): void {
  // Show table
  console.log(`\n${formatValidationTable(results)}`);

  // Show constraint compliance summary
  const constraintSystem = getGlobalConstraintSystem();
  const status = constraintSystem.getSystemStatus();

  if (!status.isHealthy) {
    console.log(chalk.yellow("\n⚠️  Constraint Violations Detected:"));
    for (const critical of status.violations.criticalViolations) {
      console.log(`   ${chalk.red("•")} ${critical}`);
    }
  }

  // Show detailed errors if present
  if (options.verbose || results.some((r) => r.errors.length > 0)) {
    const errorDetails = formatErrorDetails(results);
    if (errorDetails) {
      console.log(errorDetails);
    }
  }

  // Show warnings if verbose or if there are warnings
  if (options.verbose || results.some((r) => r.warnings.length > 0)) {
    const warningDetails = formatWarningDetails(results);
    if (warningDetails) {
      console.log(warningDetails);
    }
  }

  // Show summary with constraint compliance
  console.log(formatSummary(results));

  // Show performance summary
  const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);
  const avgTime = totalTime / results.length;
  const maxTime = Math.max(...results.map((r) => r.processingTime));

  console.log(
    chalk.dim(
      `Performance: avg ${Math.round(avgTime)}ms, max ${Math.round(maxTime)}ms, total ${Math.round(totalTime)}ms`,
    ),
  );

  if (maxTime > 750) {
    console.log(chalk.yellow("Warning: Some operations exceeded 750ms constraint"));
  }
}

/**
 * Utility to chunk array for batch processing
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
