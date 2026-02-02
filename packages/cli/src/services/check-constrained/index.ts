import path from "node:path";
import { ConstraintViolationError, getGlobalConstraintSystem } from "@/constraints/index.js";
import { validateCUE } from "@/cue/index.js";
import type { CLIConfig, CheckOptions, ValidationResult } from "@/types.js";
import { ProgressBar } from "@/utils/api/progress.js";
import {
  formatErrorDetails,
  formatFileSize,
  formatJson,
  formatSummary,
  formatValidationTable,
  formatWarningDetails,
} from "@/utils/util/output/formatting.js";
import { translateCueErrors } from "@arbiter/specification";
import chalk from "chalk";
import fs from "fs-extra";
import { glob } from "glob";

interface ConstrainedCheckOptions extends CheckOptions {
  quiet?: boolean;
  sync?: boolean;
  format?: "table" | "json";
}

const MAX_OPERATION_TIME_MS = 10_000;
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;
const REQUEST_DELAY_MS = 0;

/**
 * Enhanced check command with comprehensive constraint enforcement
 * Implements all "Don'ts" from docs/ARCHITECTURE_REVIEW.md section 13
 */
export async function checkCommandConstrained(
  patterns: string[],
  options: ConstrainedCheckOptions,
  config: CLIConfig,
): Promise<number> {
  const structuredOutput = options.format === "json";
  const constraintSystem = getGlobalConstraintSystem();

  try {
    return await constraintSystem.executeWithConstraints(
      "check",
      { sandbox: "check" },
      async () => await runCheckWithConstraints(patterns, options, config, structuredOutput),
      { maxOperationTimeMs: MAX_OPERATION_TIME_MS },
    );
  } catch (error) {
    if (error instanceof ConstraintViolationError) {
      console.error(chalk.red("Constraint violation:"), error.constraint);
      if (error.details) {
        console.error(chalk.dim(JSON.stringify(error.details, null, 2)));
      }
      return 2;
    }

    console.error(
      chalk.red("Check failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Resolve file patterns and find matching files
 */
async function resolveFilesToCheck(patterns: string[], cwd: string): Promise<string[] | null> {
  const resolvedPatterns = patterns.length > 0 ? patterns : ["**/*.cue"];

  const files = await glob(resolvedPatterns, {
    cwd,
    absolute: true,
    ignore: ["**/node_modules/**", "**/.git/**", "**/.arbiter/**"],
  });

  if (files.length === 0) {
    console.error(chalk.red("No files matched the provided patterns."));
    return null;
  }

  return files;
}

/**
 * Process a single file validation
 */
async function processFileValidation(
  file: string,
  cwd: string,
): Promise<{ result: ValidationResult; contentBytes: number }> {
  const start = Date.now();
  const content = await fs.readFile(file, "utf-8");
  const contentBytes = Buffer.byteLength(content);

  const validation = await validateCUE(content);
  const translated = validation.errors.flatMap((message) => translateCueErrors(message));

  const errors = translated.map((error) => ({
    line: 0,
    column: 0,
    message: error.friendlyMessage,
    severity: "error" as const,
    category: error.category,
  }));

  const status: ValidationResult["status"] =
    validation.valid && errors.length === 0 ? "valid" : "invalid";

  const result: ValidationResult = {
    file: path.relative(cwd, file) || path.basename(file),
    status,
    errors,
    warnings: [],
    processingTime: Date.now() - start,
  };

  return { result, contentBytes };
}

/**
 * Format and output validation results
 */
function outputValidationResults(
  results: ValidationResult[],
  options: ConstrainedCheckOptions,
  structuredOutput: boolean,
  totalErrors: number,
  totalWarnings: number,
  fileCount: number,
  payloadBytes: number,
): void {
  if (structuredOutput) {
    console.log(formatJson(results));
    return;
  }

  console.log(formatValidationTable(results));

  if (totalWarnings > 0 && !options.quiet) {
    console.log("\nWarnings:");
    console.log(formatWarningDetails(results));
  }

  if (totalErrors > 0) {
    console.log("\nErrors:");
    console.log(formatErrorDetails(results));
  }

  console.log(
    formatSummary(results),
    chalk.dim(`\nProcessed ${fileCount} files, ${formatFileSize(payloadBytes)} total`),
  );
}

async function runCheckWithConstraints(
  patterns: string[],
  options: ConstrainedCheckOptions,
  config: CLIConfig,
  structuredOutput: boolean,
): Promise<number> {
  const cwd = config.projectDir || process.cwd();

  const files = await resolveFilesToCheck(patterns, cwd);
  if (!files) {
    return 1;
  }

  const results: ValidationResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let payloadBytes = 0;

  const progress = new ProgressBar({ title: "Validating", total: files.length });

  for (const file of files) {
    const { result, contentBytes } = await processFileValidation(file, cwd);
    payloadBytes += contentBytes;

    // Enforce payload size limit
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
      throw new ConstraintViolationError(
        "maxPayloadSize",
        formatFileSize(payloadBytes),
        formatFileSize(MAX_PAYLOAD_BYTES),
        { fileCount: results.length + 1, file },
      );
    }

    results.push(result);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    progress.increment(1, result.file);
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  progress.complete("Validation complete");

  outputValidationResults(
    results,
    options,
    structuredOutput,
    totalErrors,
    totalWarnings,
    files.length,
    payloadBytes,
  );

  return totalErrors > 0 ? 1 : 0;
}
