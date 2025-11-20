// @ts-nocheck
import path from "node:path";
import { translateCueErrors } from "@arbiter/shared";
import chalk from "chalk";
import fs from "fs-extra";
import { glob } from "glob";
import { ApiClient } from "../../api-client.js";
import { ConstraintViolationError, getGlobalConstraintSystem } from "../../constraints/index.js";
import { validateCUE } from "../../cue/index.js";
import type { CLIConfig, CheckOptions, ValidationResult } from "../../types.js";
import {
  formatErrorDetails,
  formatFileSize,
  formatJson,
  formatSummary,
  formatValidationTable,
  formatWarningDetails,
} from "../../utils/formatting.js";
import { withProgress } from "../../utils/progress.js";

const MAX_OPERATION_TIME_MS = 10_000;
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;
const REQUEST_DELAY_MS = 0;

/**
 * Enhanced check command with comprehensive constraint enforcement
 * Implements all "Don'ts" from TODO.md section 13
 */
export async function checkCommandConstrained(
  patterns: string[],
  options: CheckOptions,
  config: CLIConfig,
): Promise<number> {
  const structuredOutput = options.format === "json";
  const constraintSystem = getGlobalConstraintSystem();

  try {
    return await constraintSystem.executeWithConstraints(
      "check",
      {
        sandbox: "check",
        maxOperationTimeMs: MAX_OPERATION_TIME_MS,
        maxPayloadBytes: MAX_PAYLOAD_BYTES,
        requestDelayMs: REQUEST_DELAY_MS,
      },
      async () => await runCheckWithConstraints(patterns, options, config, structuredOutput),
    );
  } catch (error) {
    if (error instanceof ConstraintViolationError) {
      console.error(chalk.red("Constraint violation:"));
      for (const violation of error.violations) {
        console.error(`  • ${violation.rule} - ${violation.message}`);
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
  options: CheckOptions,
  config: CLIConfig,
  structuredOutput: boolean,
): Promise<number> {
  const apiClient = new ApiClient(config);

  // Expand glob patterns to file list
  const files = await glob(patterns, {
    ignore: ["**/node_modules/**", "**/.git/**", "**/.arbiter/**"],
  });

  if (files.length === 0) {
    console.error(chalk.red("No files matched the provided patterns."));
    return 1;
  }

  const results: ValidationResult[] = [];
  const totalFiles = files.length;
  let totalErrors = 0;
  let totalWarnings = 0;
  let payloadBytes = 0;

  const progress = withProgress("Validating", totalFiles);

  for (const file of files) {
    const content = await fs.readFile(file, "utf-8");
    payloadBytes += Buffer.byteLength(content);

    // Enforce payload size limit
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
      throw new ConstraintViolationError(
        "MAX_PAYLOAD_SIZE",
        `Payload exceeds ${MAX_PAYLOAD_BYTES} bytes`,
        [
          {
            rule: "MAX_PAYLOAD_SIZE",
            message: `Total payload size ${formatFileSize(payloadBytes)} exceeds limit`,
          },
        ],
      );
    }

    const validation = await validateCUE(content);
    const translatedErrors = translateCueErrors(validation.errors);

    const result: ValidationResult = {
      file,
      valid: validation.valid,
      errors: translatedErrors,
      warnings: validation.warnings || [],
      durationMs: validation.durationMs,
      sizeBytes: Buffer.byteLength(content),
    };

    results.push(result);
    totalErrors += translatedErrors.length;
    totalWarnings += result.warnings?.length || 0;

    progress.increment();
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  progress.stop();

  if (structuredOutput) {
    console.log(formatJson(results));
  } else {
    console.log(formatValidationTable(results));
    console.log(
      formatSummary({
        files: totalFiles,
        errors: totalErrors,
        warnings: totalWarnings,
        durationMs: results.reduce((sum, r) => sum + (r.durationMs || 0), 0),
        totalSizeBytes: payloadBytes,
      }),
    );

    if (totalWarnings > 0 && !options.quiet) {
      console.log("\nWarnings:");
      console.log(formatWarningDetails(results));
    }

    if (totalErrors > 0) {
      console.log("\nErrors:");
      console.log(formatErrorDetails(results));
    }
  }

  // If requested, sync validated files to server
  if (options.sync) {
    console.log(chalk.blue("\n🔄 Syncing validated files to Arbiter server..."));
    for (const result of results) {
      const relativePath = path.relative(process.cwd(), result.file);
      const content = await fs.readFile(result.file, "utf-8");
      const syncResult = await apiClient.syncFile(relativePath, content);
      if (!syncResult.success) {
        console.error(chalk.red(`Failed to sync ${relativePath}: ${syncResult.error}`));
      } else if (!structuredOutput) {
        console.log(chalk.green(`Synced ${relativePath}`));
      }
    }
  }

  return totalErrors > 0 ? 1 : 0;
}
// @ts-nocheck
