/**
 * @packageDocumentation
 * Validation handling utilities for generate command.
 *
 * Provides functionality to:
 * - Handle specification validation results
 * - Determine if generation should proceed
 * - Report validation issues to users
 */

import type { GenerateOptions, GenerationReporter } from "@/services/generate/util/types.js";
import { formatWarnings, validateSpecification } from "@/validation/warnings.js";

/**
 * Result of handling validation.
 */
export interface ValidationHandlerResult {
  proceed: boolean;
  exitCode?: number;
}

/**
 * Handle validation result and determine if generation should proceed.
 */
export function handleValidationResult(
  validationResult: ReturnType<typeof validateSpecification>,
  options: GenerateOptions,
  reporter: GenerationReporter,
): ValidationHandlerResult {
  if (validationResult.hasErrors) {
    reporter.info(formatWarnings(validationResult));
    reporter.error("\n❌ Cannot generate with errors present. Please fix the errors above.");
    return { proceed: false, exitCode: 1 };
  }

  if (validationResult.hasWarnings) {
    reporter.warn("\n⚠️  Specification validation warnings found:");
    reporter.warn(formatWarnings(validationResult));

    if (!options.force) {
      reporter.info("\n💡 To proceed: Add --force flag to generate with warnings");
      reporter.info(
        "Recommendation: Fix the warnings above for a complete, production-ready specification.",
      );
      return { proceed: false, exitCode: 1 };
    }

    reportForceWarnings(reporter);
  } else {
    reporter.info("✅ Specification validation passed");
  }

  return { proceed: true };
}

/**
 * Report warnings when --force is used.
 */
export function reportForceWarnings(reporter: GenerationReporter): void {
  reporter.warn("\n⚠️  Generating despite warnings (--force used)");
  reporter.warn("\n🚨 REMINDER FOR AI AGENTS:");
  reporter.warn(
    "You should have requested user approval before using --force with incomplete specifications.",
  );
  reporter.warn("This may result in production issues that require additional work later.");
}

/**
 * Report generation results to the user.
 */
export function reportResults(
  results: string[],
  options: GenerateOptions,
  reporter: GenerationReporter,
): void {
  if (options.dryRun) {
    reporter.info("🔍 Dry run - files that would be generated:");
    results.forEach((file) => reporter.info(`  ${file}`));
  } else {
    reporter.info(`✅ Generated ${results.length} files:`);
    results.forEach((file) => reporter.info(`  ✓ ${file}`));
  }
}
