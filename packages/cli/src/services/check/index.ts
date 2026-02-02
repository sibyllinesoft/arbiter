/**
 * @packageDocumentation
 * Check command - Validate CUE specification files.
 *
 * Provides functionality to:
 * - Validate CUE files against schema
 * - Display validation results in table or JSON format
 * - Report errors and warnings with context
 * - Support glob patterns for file matching
 */

import path from "node:path";
import { validateCUE } from "@/cue/index.js";
import { ApiClient } from "@/io/api/api-client.js";
import { SystemRepository } from "@/repositories/system-repository.js";
import { isMarkdownStorage } from "@/services/add/markdown-handlers.js";
import type { CLIConfig, CheckOptions, ValidationResult } from "@/types.js";
import { withProgress } from "@/utils/api/progress.js";
import { MarkdownStorage } from "@/utils/storage/markdown-storage.js";
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

/**
 * Get file patterns, using default if none provided.
 * Includes .arbiter directory by default since it contains the main spec.
 */
function getFilePatterns(patterns: string[]): string[] {
  return patterns.length > 0 ? patterns : [".arbiter/**/*.cue", "**/*.cue"];
}

/**
 * Handle case when no files are found.
 */
function handleNoFilesFound(structuredOutput: boolean, color: boolean): number {
  if (structuredOutput) {
    console.log(formatJson([], color));
  } else {
    console.log(chalk.yellow("No CUE files found"));
  }
  return 0;
}

/**
 * Output validation results based on format.
 */
function outputResults(
  results: ValidationResult[],
  structuredOutput: boolean,
  options: CheckOptions,
  config: CLIConfig,
): void {
  if (structuredOutput) {
    console.log(formatJson(results, config.color));
  } else {
    displayResults(results, options, config);
  }
}

/**
 * Check command implementation
 * Validates CUE files in the current directory with pretty output and proper exit codes
 * @param injectedClient - Optional pre-created ApiClient (for testing)
 */
export async function runCheckCommand(
  patterns: string[],
  options: CheckOptions,
  config: CLIConfig,
  injectedClient?: ApiClient,
): Promise<number> {
  const structuredOutput = isJsonFormat(options);
  const projectDir = config.projectDir ?? process.cwd();

  try {
    // Check if project uses markdown-first storage
    const useMarkdown = await isMarkdownStorage(projectDir);

    if (useMarkdown) {
      return await validateMarkdownStorage(projectDir, options, config);
    }

    // Legacy CUE-based validation
    const effectivePatterns = getFilePatterns(patterns);
    const files = await findCueFiles(effectivePatterns, {
      recursive: options.recursive ?? true,
      cwd: config.projectDir,
    });

    if (files.length === 0) {
      return handleNoFilesFound(structuredOutput, config.color);
    }

    if (!structuredOutput) {
      console.log(chalk.dim(`Found ${files.length} CUE files`));
    }

    const results = await validateFiles(files, config, options, structuredOutput, injectedClient);
    outputResults(results, structuredOutput, options, config);

    const hasErrors = results.some((r) => r.status === "invalid" || r.status === "error");
    return hasErrors ? 1 : 0;
  } catch (error) {
    console.error(
      chalk.red("Check command failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 2;
  }
}

/**
 * Validate markdown storage project by building CUE in-memory
 */
async function validateMarkdownStorage(
  projectDir: string,
  options: CheckOptions,
  config: CLIConfig,
): Promise<number> {
  const structuredOutput = isJsonFormat(options);

  if (!structuredOutput) {
    console.log(chalk.dim("Validating markdown-first specification..."));
  }

  try {
    const storage = new MarkdownStorage(path.join(projectDir, ".arbiter"));
    const validationResult = await storage.validate();

    if (validationResult.valid) {
      if (!structuredOutput) {
        console.log(chalk.green("✓ Specification is valid"));

        // Show entity count
        const graph = await storage.getGraph();
        const nodeCount = graph.nodes.size;
        const edgeCount = graph.edges.length;
        console.log(chalk.dim(`  ${nodeCount} entities, ${edgeCount} relationships`));
      } else {
        console.log(
          formatJson(
            [
              {
                file: ".arbiter/",
                status: "valid",
                errors: [],
                warnings: [],
              },
            ],
            config.color,
          ),
        );
      }
      return 0;
    }

    // Report errors
    if (!structuredOutput) {
      console.log(chalk.red("✗ Specification has errors"));
      for (const error of validationResult.errors) {
        const location = error.filePath ? `.arbiter/${error.filePath}` : ".arbiter/";
        console.log(chalk.red(`  ${location}: ${error.message}`));
      }
      for (const warning of validationResult.warnings) {
        const location = warning.filePath ? `.arbiter/${warning.filePath}` : ".arbiter/";
        console.log(chalk.yellow(`  ${location}: ${warning.message}`));
      }
    } else {
      const results = validationResult.errors.map((err) => ({
        file: err.filePath || ".arbiter/",
        status: "invalid",
        errors: [
          {
            line: err.line || 0,
            column: err.column || 0,
            message: err.message,
            severity: "error" as const,
            category: "validation",
          },
        ],
        warnings: [],
      }));
      console.log(formatJson(results, config.color));
    }

    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!structuredOutput) {
      console.error(chalk.red(`Validation failed: ${message}`));
    } else {
      console.log(
        formatJson(
          [
            {
              file: ".arbiter/",
              status: "error",
              errors: [
                {
                  line: 0,
                  column: 0,
                  message,
                  severity: "error" as const,
                  category: "system",
                },
              ],
              warnings: [],
            },
          ],
          config.color,
        ),
      );
    }
    return 2;
  }
}

export function isJsonFormat(options: CheckOptions): boolean {
  return options.format === "json";
}

/**
 * Find CUE files matching the given patterns
 */
export async function findCueFiles(
  patterns: string[],
  options: {
    recursive: boolean;
    cwd: string;
  },
): Promise<string[]> {
  const allFiles: string[] = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: options.cwd,
      absolute: true,
      dot: true, // Include hidden directories like .arbiter
      ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
    });

    allFiles.push(...files);
  }

  // Remove duplicates and sort
  return [...new Set(allFiles)].sort();
}

/**
 * Validate multiple files with progress tracking
 * @param injectedClient - Optional pre-created client (for testing)
 */
async function validateFiles(
  files: string[],
  config: CLIConfig,
  options: CheckOptions,
  suppressInteractiveOutput = false,
  injectedClient?: ApiClient,
): Promise<ValidationResult[]> {
  if (config.localMode) {
    return await validateFilesLocally(files, config, options, suppressInteractiveOutput);
  }

  const apiClient = await initializeApiClient(config, injectedClient);

  return await executeValidationWithProgress(
    files,
    config,
    apiClient,
    options,
    suppressInteractiveOutput,
  );
}

/**
 * Initialize API client with health check
 * @param config - CLI configuration
 * @param injectedClient - Optional pre-created client (for testing)
 */
async function initializeApiClient(
  config: CLIConfig,
  injectedClient?: ApiClient,
): Promise<ApiClient> {
  const apiClient = injectedClient ?? new ApiClient(config);
  const systemRepo = new SystemRepository(apiClient);

  const healthCheck = await systemRepo.health();
  if (!healthCheck.success) {
    throw new Error(`Cannot connect to Arbiter server: ${healthCheck.error}`);
  }

  return apiClient;
}

/**
 * Execute validation with progress tracking
 */
async function executeValidationWithProgress(
  files: string[],
  config: CLIConfig,
  apiClient: ApiClient,
  options: CheckOptions,
  suppressInteractiveOutput: boolean,
): Promise<ValidationResult[]> {
  const progressText = `Validating ${files.length} files...`;

  if (suppressInteractiveOutput) {
    return await processFilesInChunks(files, config, apiClient, options, true);
  }

  return withProgress({ text: progressText, color: "blue" }, async () => {
    return await processFilesInChunks(files, config, apiClient, options, false);
  });
}

/**
 * Process files in chunks with concurrency control
 */
async function processFilesInChunks(
  files: string[],
  config: CLIConfig,
  apiClient: ApiClient,
  options: CheckOptions,
  suppressInteractiveOutput: boolean,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const concurrency = 5; // Limit concurrent requests
  const chunks = chunkArray(files, concurrency);

  for (const chunk of chunks) {
    const chunkResults = await processFileChunk(
      chunk,
      config,
      apiClient,
      options,
      suppressInteractiveOutput,
    );
    results.push(...chunkResults);

    if (shouldStopProcessing(options, chunkResults)) {
      break;
    }
  }

  return results;
}

/**
 * Process a single chunk of files
 */
async function processFileChunk(
  chunk: string[],
  config: CLIConfig,
  apiClient: ApiClient,
  options: CheckOptions,
  suppressInteractiveOutput: boolean,
): Promise<ValidationResult[]> {
  return await Promise.all(
    chunk.map(async (file) => {
      const result = await validateFile(file, apiClient, options);

      if (options.verbose && !suppressInteractiveOutput) {
        logFileValidationResult(file, result, config);
      }

      return result;
    }),
  );
}

/**
 * Log validation result for a file
 */
function logFileValidationResult(file: string, result: ValidationResult, config: CLIConfig): void {
  const status = getStatusIcon(result.status);
  console.log(`${status} ${path.relative(config.projectDir, file)}`);
}

/**
 * Get status icon for validation result
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case "valid":
      return chalk.green("✓");
    case "invalid":
      return chalk.red("✗");
    default:
      return chalk.yellow("!");
  }
}

/**
 * Determine if processing should stop based on fail-fast option
 */
function shouldStopProcessing(options: CheckOptions, chunkResults: ValidationResult[]): boolean {
  return options.failFast && chunkResults.some((r) => r.status !== "valid");
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Check if file meets basic requirements for validation
 */
async function checkFileRequirements(
  filePath: string,
  startTime: number,
): Promise<ValidationResult | null> {
  const stats = await fs.stat(filePath);

  if (!stats.isFile()) {
    return buildErrorResult(filePath, "Not a file", "system", startTime);
  }

  if (stats.size > MAX_FILE_SIZE) {
    return buildErrorResult(
      filePath,
      `File too large (${formatFileSize(stats.size)}), maximum allowed: ${formatFileSize(MAX_FILE_SIZE)}`,
      "system",
      startTime,
    );
  }

  return null;
}

/**
 * Build a validation error result
 */
function buildErrorResult(
  filePath: string,
  message: string,
  category: string,
  startTime: number,
): ValidationResult {
  return {
    file: path.basename(filePath),
    status: "error",
    errors: [{ line: 0, column: 0, message, severity: "error" as const, category }],
    warnings: [],
    processingTime: Date.now() - startTime,
  };
}

/**
 * Process API validation response into ValidationResult
 */
function processValidationResponse(
  filePath: string,
  data: {
    success: boolean;
    errors?: Array<{ message: string; line?: number; column?: number }>;
    warnings?: Array<{ message: string; line?: number; column?: number }>;
  },
  startTime: number,
): ValidationResult {
  const errors = (data.errors ?? []).map((error) => {
    const translated = translateCueErrors(error.message);
    return {
      line: error.line || 0,
      column: error.column || 0,
      message: translated[0]?.friendlyMessage || error.message,
      severity: "error" as const,
      category: translated[0]?.category || "validation",
    };
  });

  const warnings = (data.warnings ?? []).map((warning) => ({
    line: warning.line || 0,
    column: warning.column || 0,
    message: warning.message,
    category: "validation",
  }));

  return {
    file: path.basename(filePath),
    status: data.success ? "valid" : "invalid",
    errors,
    warnings,
    processingTime: Date.now() - startTime,
  };
}

/**
 * Validate a single file
 */
async function validateFile(
  filePath: string,
  apiClient: ApiClient,
  _options: CheckOptions,
): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    const fileError = await checkFileRequirements(filePath, startTime);
    if (fileError) return fileError;

    const content = await fs.readFile(filePath, "utf-8");
    const validationResult = await apiClient.validate(content);

    if (!validationResult.success || !validationResult.data) {
      return buildErrorResult(
        filePath,
        validationResult.error || "Unknown validation error",
        "api",
        startTime,
      );
    }

    return processValidationResponse(filePath, validationResult.data, startTime);
  } catch (error) {
    return buildErrorResult(
      filePath,
      error instanceof Error ? error.message : String(error),
      "system",
      startTime,
    );
  }
}

/**
 * Display validation results with proper formatting
 */
function displayResults(
  results: ValidationResult[],
  options: CheckOptions,
  _config: CLIConfig,
): void {
  // Show table
  console.log(`\n${formatValidationTable(results)}`);

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

  // Show summary
  console.log(formatSummary(results));
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

/**
 * Validate files locally without contacting the Arbiter service
 */
async function validateFilesLocally(
  files: string[],
  config: CLIConfig,
  options: CheckOptions,
  suppressInteractiveOutput: boolean,
): Promise<ValidationResult[]> {
  const progressText = `Validating ${files.length} files locally...`;

  const runner = async (): Promise<ValidationResult[]> => {
    const results: ValidationResult[] = [];

    for (const file of files) {
      const result = await validateFileLocally(file);
      results.push(result);

      if (options.verbose && !suppressInteractiveOutput) {
        logFileValidationResult(file, result, config);
      }

      if (shouldStopProcessing(options, [result])) {
        break;
      }
    }

    return results;
  };

  if (suppressInteractiveOutput) {
    return await runner();
  }

  return await withProgress({ text: progressText, color: "blue" }, runner);
}

/**
 * Check local file requirements (size, type)
 */
async function checkLocalFileRequirements(
  filePath: string,
  startTime: number,
): Promise<ValidationResult | null> {
  const stats = await fs.stat(filePath);

  if (!stats.isFile()) {
    return buildSystemErrorResult(filePath, "Not a file", startTime);
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (stats.size > maxSize) {
    return buildSystemErrorResult(
      filePath,
      `File too large (${formatFileSize(stats.size)}), maximum allowed: ${formatFileSize(maxSize)}`,
      startTime,
    );
  }

  return null;
}

/**
 * Build valid result for a file
 */
function buildValidResult(filePath: string, startTime: number): ValidationResult {
  return {
    file: path.basename(filePath),
    status: "valid",
    errors: [],
    warnings: [],
    processingTime: Date.now() - startTime,
  };
}

/**
 * Build invalid result with translated errors
 */
function buildInvalidResult(
  filePath: string,
  validationErrors: string[],
  startTime: number,
): ValidationResult {
  const errors = validationErrors.map((message) => {
    const translated = translateCueErrors(message);
    return {
      line: 0,
      column: 0,
      message: translated[0]?.friendlyMessage || message,
      severity: "error" as const,
      category: translated[0]?.category || "validation",
    };
  });

  return {
    file: path.basename(filePath),
    status: "invalid",
    errors,
    warnings: [],
    processingTime: Date.now() - startTime,
  };
}

/**
 * Local validation implementation for a single file
 */
async function validateFileLocally(filePath: string): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    const fileError = await checkLocalFileRequirements(filePath, startTime);
    if (fileError) return fileError;

    const content = await fs.readFile(filePath, "utf-8");
    const validation = await validateCUE(content);

    if (validation.valid) {
      return buildValidResult(filePath, startTime);
    }

    return buildInvalidResult(filePath, validation.errors, startTime);
  } catch (error) {
    return buildSystemErrorResult(
      filePath,
      error instanceof Error ? error.message : String(error),
      startTime,
    );
  }
}

function buildSystemErrorResult(
  filePath: string,
  message: string,
  startTime: number,
): ValidationResult {
  return buildErrorResult(filePath, message, "system", startTime);
}
