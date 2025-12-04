import path from "node:path";
import { ConstraintViolationError, getGlobalConstraintSystem } from "@/constraints/index.js";
import { validateCUE } from "@/cue/index.js";
import type { CLIConfig, CheckOptions, ValidationResult } from "@/types.js";
import {
  formatErrorDetails,
  formatFileSize,
  formatJson,
  formatSummary,
  formatValidationTable,
  formatWarningDetails,
} from "@/utils/formatting.js";
import { ProgressBar } from "@/utils/progress.js";
import { translateCueErrors } from "@arbiter/shared";
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
 * Implements all "Don'ts" from TODO.md section 13
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

async function runCheckWithConstraints(
  patterns: string[],
  options: ConstrainedCheckOptions,
  config: CLIConfig,
  structuredOutput: boolean,
): Promise<number> {
  const cwd = config.projectDir || process.cwd();
  const resolvedPatterns = patterns.length > 0 ? patterns : ["**/*.cue"];

  const files = await glob(resolvedPatterns, {
    cwd,
    absolute: true,
    ignore: ["**/node_modules/**", "**/.git/**", "**/.arbiter/**"],
  });

  if (files.length === 0) {
    console.error(chalk.red("No files matched the provided patterns."));
    return 1;
  }

  const results: ValidationResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let payloadBytes = 0;

  const progress = new ProgressBar({ title: "Validating", total: files.length });

  for (const file of files) {
    const start = Date.now();
    const content = await fs.readFile(file, "utf-8");
    payloadBytes += Buffer.byteLength(content);

    // Enforce payload size limit
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
      throw new ConstraintViolationError(
        "maxPayloadSize",
        formatFileSize(payloadBytes),
        formatFileSize(MAX_PAYLOAD_BYTES),
        { fileCount: results.length + 1, file },
      );
    }

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

    results.push(result);
    totalErrors += errors.length;
    totalWarnings += result.warnings.length;

    progress.increment(1, result.file);
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  progress.complete("Validation complete");

  if (structuredOutput) {
    console.log(formatJson(results));
  } else {
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
      chalk.dim(`\nProcessed ${files.length} files, ${formatFileSize(payloadBytes)} total`),
    );
  }

  return totalErrors > 0 ? 1 : 0;
}
