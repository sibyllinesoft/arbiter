import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { translateCueErrors } from '@arbiter/shared';
import { ApiClient } from '../api-client.js';
import { 
  formatValidationTable, 
  formatErrorDetails, 
  formatWarningDetails, 
  formatSummary,
  formatJson,
  formatFileSize
} from '../utils/formatting.js';
import { withProgress } from '../utils/progress.js';
import type { CheckOptions, CLIConfig, ValidationResult } from '../types.js';

/**
 * Check command implementation
 * Validates CUE files in the current directory with pretty output and proper exit codes
 */
export async function checkCommand(
  patterns: string[],
  options: CheckOptions,
  config: CLIConfig
): Promise<number> {
  try {
    // Use default pattern if none provided
    if (patterns.length === 0) {
      patterns = ['**/*.cue'];
    }

    // Find all matching files
    const files = await findCueFiles(patterns, {
      recursive: options.recursive ?? true,
      cwd: config.projectDir,
    });

    if (files.length === 0) {
      console.log(chalk.yellow('No CUE files found'));
      return 0;
    }

    console.log(chalk.dim(`Found ${files.length} CUE files`));

    // Validate files
    const results = await validateFiles(files, config, options);

    // Format and display results
    if (options.format === 'json') {
      console.log(formatJson(results, config.color));
    } else {
      displayResults(results, options, config);
    }

    // Determine exit code
    const hasErrors = results.some(r => r.status === 'invalid' || r.status === 'error');
    return hasErrors ? 1 : 0;

  } catch (error) {
    console.error(chalk.red('Check command failed:'), error instanceof Error ? error.message : String(error));
    return 2;
  }
}

/**
 * Find CUE files matching the given patterns
 */
async function findCueFiles(patterns: string[], options: {
  recursive: boolean;
  cwd: string;
}): Promise<string[]> {
  const allFiles: string[] = [];
  
  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: options.cwd,
      absolute: true,
      ignore: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
      ],
    });
    
    allFiles.push(...files);
  }

  // Remove duplicates and sort
  return [...new Set(allFiles)].sort();
}

/**
 * Validate multiple files with progress tracking
 */
async function validateFiles(
  files: string[],
  config: CLIConfig,
  options: CheckOptions
): Promise<ValidationResult[]> {
  const apiClient = new ApiClient(config);
  const results: ValidationResult[] = [];
  
  // Check server health first
  const healthCheck = await apiClient.health();
  if (!healthCheck.success) {
    throw new Error(`Cannot connect to Arbiter server: ${healthCheck.error}`);
  }

  let processedCount = 0;
  const progressText = `Validating ${files.length} files...`;

  return withProgress(
    { text: progressText, color: 'blue' },
    async () => {
      // Process files with concurrency limit for performance
      const concurrency = 5; // Limit concurrent requests
      const chunks = chunkArray(files, concurrency);

      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(async (file) => {
            const result = await validateFile(file, apiClient, options);
            processedCount++;
            
            if (options.verbose) {
              const status = result.status === 'valid' ? chalk.green('✓') : 
                           result.status === 'invalid' ? chalk.red('✗') : 
                           chalk.yellow('!');
              console.log(`${status} ${path.relative(config.projectDir, file)}`);
            }

            return result;
          })
        );

        results.push(...chunkResults);

        // Fail fast if requested and we have errors
        if (options.failFast && chunkResults.some(r => r.status !== 'valid')) {
          break;
        }
      }

      return results;
    }
  );
}

/**
 * Validate a single file
 */
async function validateFile(
  filePath: string,
  apiClient: ApiClient,
  options: CheckOptions
): Promise<ValidationResult> {
  const startTime = Date.now();
  
  try {
    // Check if file exists and is readable
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return {
        file: path.basename(filePath),
        status: 'error',
        errors: [{
          line: 0,
          column: 0,
          message: 'Not a file',
          severity: 'error' as const,
          category: 'system',
        }],
        warnings: [],
        processingTime: Date.now() - startTime,
      };
    }

    // Check file size (limit to reasonable size for performance)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (stats.size > maxSize) {
      return {
        file: path.basename(filePath),
        status: 'error',
        errors: [{
          line: 0,
          column: 0,
          message: `File too large (${formatFileSize(stats.size)}), maximum allowed: ${formatFileSize(maxSize)}`,
          severity: 'error' as const,
          category: 'system',
        }],
        warnings: [],
        processingTime: Date.now() - startTime,
      };
    }

    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Validate using API
    const validationResult = await apiClient.validate(content);
    
    if (!validationResult.success || !validationResult.data) {
      return {
        file: path.basename(filePath),
        status: 'error',
        errors: [{
          line: 0,
          column: 0,
          message: validationResult.error || 'Unknown validation error',
          severity: 'error' as const,
          category: 'api',
        }],
        warnings: [],
        processingTime: Date.now() - startTime,
      };
    }

    const data = validationResult.data;
    
    // Process errors with enhanced translation
    const errors = data.errors?.map(error => {
      const translated = translateCueErrors(error.message);
      return {
        line: error.line || 0,
        column: error.column || 0,
        message: translated[0]?.friendlyMessage || error.message,
        severity: 'error' as const,
        category: translated[0]?.category || 'validation',
      };
    }) || [];

    // Process warnings
    const warnings = data.warnings?.map(warning => ({
      line: warning.line || 0,
      column: warning.column || 0,
      message: warning.message,
      category: 'validation',
    })) || [];

    const status = data.success ? 'valid' : 'invalid';

    return {
      file: path.basename(filePath),
      status,
      errors,
      warnings,
      processingTime: Date.now() - startTime,
    };

  } catch (error) {
    return {
      file: path.basename(filePath),
      status: 'error',
      errors: [{
        line: 0,
        column: 0,
        message: error instanceof Error ? error.message : String(error),
        severity: 'error' as const,
        category: 'system',
      }],
      warnings: [],
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Display validation results with proper formatting
 */
function displayResults(
  results: ValidationResult[],
  options: CheckOptions,
  config: CLIConfig
): void {
  // Show table
  console.log('\n' + formatValidationTable(results));

  // Show detailed errors if present
  if (options.verbose || results.some(r => r.errors.length > 0)) {
    const errorDetails = formatErrorDetails(results);
    if (errorDetails) {
      console.log(errorDetails);
    }
  }

  // Show warnings if verbose or if there are warnings
  if (options.verbose || results.some(r => r.warnings.length > 0)) {
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