import path from 'node:path';
import chalk from 'chalk';
import fs from 'fs-extra';
import { glob } from 'glob';
import { ApiClient } from '../api-client.js';
import type { CLIConfig, ValidateOptions, ValidationResult } from '../types.js';
import {
  formatErrorDetails,
  formatJson,
  formatSummary,
  formatValidationTable,
  formatWarningDetails,
  formatYaml,
} from '../utils/formatting.js';
import { withProgress } from '../utils/progress.js';

/**
 * Validate command implementation
 * Explicit validation with schema and config options
 */
export async function validateCommand(
  files: string[],
  options: ValidateOptions,
  config: CLIConfig
): Promise<number> {
  try {
    // Auto-discover files if none specified
    if (files.length === 0) {
      files = await discoverSpecificationFiles(config.projectDir);

      if (files.length === 0) {
        console.log(chalk.yellow('No specification files found'));
        return 0;
      }
    }

    // Resolve file paths
    const resolvedFiles = await resolveFiles(files, config.projectDir);

    if (resolvedFiles.length === 0) {
      console.error(chalk.red('No valid files found'));
      return 1;
    }

    console.log(chalk.dim(`Validating ${resolvedFiles.length} files with comprehensive checks...`));

    // Load schema if specified
    let schemaContent: string | undefined;
    if (options.schema) {
      try {
        schemaContent = await fs.readFile(options.schema, 'utf-8');
      } catch (_error) {
        console.error(chalk.red(`Cannot read schema file: ${options.schema}`));
        return 1;
      }
    }

    // Load config if specified
    let configContent: string | undefined;
    if (options.config) {
      try {
        configContent = await fs.readFile(options.config, 'utf-8');
      } catch (_error) {
        console.error(chalk.red(`Cannot read config file: ${options.config}`));
        return 1;
      }
    }

    // Perform comprehensive validation
    const results = await performComprehensiveValidation(
      resolvedFiles,
      config,
      options,
      schemaContent,
      configContent
    );

    // Format and display results
    if (config.format === 'json') {
      console.log(formatJson(results, config.color));
    } else if (config.format === 'yaml') {
      console.log(formatYaml(results));
    } else {
      displayComprehensiveResults(results, options, config);
    }

    // Determine exit code
    const hasErrors = results.some(r => r.status === 'invalid' || r.status === 'error');
    const hasWarnings = results.some(r => r.warnings && r.warnings.length > 0);

    if (hasErrors) {
      return 1;
    }

    // In strict mode, warnings also cause failure
    if (options.strict && hasWarnings) {
      return 1;
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red('Validate command failed:'),
      error instanceof Error ? error.message : String(error)
    );
    return 2;
  }
}

/**
 * Resolve and validate file paths
 */
async function resolveFiles(files: string[], cwd: string): Promise<string[]> {
  const resolved: string[] = [];

  for (const file of files) {
    const fullPath = path.resolve(cwd, file);

    try {
      const stats = await fs.stat(fullPath);
      if (stats.isFile()) {
        resolved.push(fullPath);
      } else if (stats.isDirectory()) {
        // Find .cue files in directory
        const dirFiles = await fs.readdir(fullPath);
        const cueFiles = dirFiles.filter(f => f.endsWith('.cue')).map(f => path.join(fullPath, f));
        resolved.push(...cueFiles);
      }
    } catch (_error) {
      console.warn(chalk.yellow(`Warning: Cannot access ${file}`));
    }
  }

  return resolved;
}

/**
 * Validate multiple files with enhanced options
 */
async function validateFiles(
  files: string[],
  config: CLIConfig,
  options: ValidateOptions,
  schemaContent?: string,
  configContent?: string
): Promise<ValidationResult[]> {
  const apiClient = await initializeValidationClient(config);

  return withProgress({ text: `Validating ${files.length} files...`, color: 'blue' }, async () => {
    return await processValidationFiles(files, apiClient, options, schemaContent, configContent);
  });
}

/**
 * Initialize and verify API client for validation
 */
async function initializeValidationClient(config: CLIConfig): Promise<ApiClient> {
  const apiClient = new ApiClient(config);

  const healthCheck = await apiClient.health();
  if (!healthCheck.success) {
    throw new Error(`Cannot connect to Arbiter server: ${healthCheck.error}`);
  }

  return apiClient;
}

/**
 * Process validation for all files
 */
async function processValidationFiles(
  files: string[],
  apiClient: ApiClient,
  options: ValidateOptions,
  schemaContent?: string,
  configContent?: string
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const file of files) {
    const result = await validateSingleFile(file, apiClient, options, schemaContent, configContent);
    results.push(result);

    if (options.verbose) {
      displayValidationProgress(result, file);
    }
  }

  return results;
}

/**
 * Display validation progress for a single file
 */
function displayValidationProgress(result: ValidationResult, file: string): void {
  const status = getValidationStatusIcon(result.status);
  console.log(`${status} ${path.basename(file)}`);
}

/**
 * Get appropriate icon for validation status
 */
function getValidationStatusIcon(status: string): string {
  switch (status) {
    case 'valid':
      return chalk.green('✓');
    case 'invalid':
      return chalk.red('✗');
    default:
      return chalk.yellow('!');
  }
}

/**
 * Validate a single file with schema and config
 */
async function validateSingleFile(
  filePath: string,
  apiClient: ApiClient,
  options: ValidateOptions,
  schemaContent?: string,
  configContent?: string
): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');

    // Combine content with schema and config if provided
    let fullContent = content;

    if (schemaContent) {
      fullContent = `${schemaContent}\n\n${fullContent}`;
    }

    if (configContent) {
      fullContent = `${fullContent}\n\n${configContent}`;
    }

    // Validate using API
    const validationResult = await apiClient.validate(fullContent, {
      strict: options.strict,
    });

    if (!validationResult.success || !validationResult.data) {
      return {
        file: path.basename(filePath),
        status: 'error',
        errors: [
          {
            line: 0,
            column: 0,
            message: validationResult.error || 'Unknown validation error',
            severity: 'error' as const,
            category: 'api',
          },
        ],
        warnings: [],
        processingTime: Date.now() - startTime,
      };
    }

    const data = validationResult.data;

    // Process errors
    const errors =
      data.errors?.map(error => ({
        line: error.line || 0,
        column: error.column || 0,
        message: error.message,
        severity: 'error' as const,
        category: 'validation',
      })) || [];

    // Process warnings
    const warnings =
      data.warnings?.map(warning => ({
        line: warning.line || 0,
        column: warning.column || 0,
        message: warning.message,
        category: 'validation',
      })) || [];

    // In strict mode, treat warnings as errors
    if (options.strict && warnings.length > 0) {
      warnings.forEach(warning => {
        errors.push({
          line: warning.line,
          column: warning.column,
          message: warning.message,
          severity: 'error' as const,
          category: warning.category,
        });
      });
    }

    const status = data.success && (!options.strict || warnings.length === 0) ? 'valid' : 'invalid';

    return {
      file: path.basename(filePath),
      status,
      errors,
      warnings: options.strict ? [] : warnings, // Clear warnings in strict mode since they become errors
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      file: path.basename(filePath),
      status: 'error',
      errors: [
        {
          line: 0,
          column: 0,
          message: error instanceof Error ? error.message : String(error),
          severity: 'error' as const,
          category: 'system',
        },
      ],
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
  options: ValidateOptions,
  _config: CLIConfig
): void {
  // Show table
  console.log(`\n${formatValidationTable(results)}`);

  // Show detailed errors if present
  if (options.verbose || results.some(r => r.errors.length > 0)) {
    const errorDetails = formatErrorDetails(results);
    if (errorDetails) {
      console.log(errorDetails);
    }
  }

  // Show warnings if verbose and not in strict mode
  if (options.verbose && !options.strict && results.some(r => r.warnings.length > 0)) {
    const warningDetails = formatWarningDetails(results);
    if (warningDetails) {
      console.log(warningDetails);
    }
  }

  // Show summary
  console.log(formatSummary(results));

  // Show strict mode note if enabled
  if (options.strict) {
    console.log(chalk.dim('\nNote: Running in strict mode (warnings treated as errors)'));
  }
}

/**
 * Auto-discover specification files in the project
 */
async function discoverSpecificationFiles(projectDir: string): Promise<string[]> {
  const patterns = [
    'arbiter.assembly.cue',
    'specs/**/*.cue',
    '**/*.assembly.cue',
    '**/*.spec.cue',
    '*.cue',
  ];

  const allFiles: string[] = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: projectDir,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
    });
    allFiles.push(...files);
  }

  // Remove duplicates and return absolute paths
  return [...new Set(allFiles)].map(file => path.resolve(projectDir, file));
}

/**
 * Perform comprehensive validation with multiple validation types
 */
async function performComprehensiveValidation(
  files: string[],
  config: CLIConfig,
  options: ValidateOptions,
  schemaContent?: string,
  configContent?: string
): Promise<ValidationResult[]> {
  const apiClient = await initializeValidationClient(config);

  return withProgress({ text: `Running comprehensive validation...`, color: 'blue' }, async () => {
    const results: ValidationResult[] = [];

    for (const file of files) {
      const result = await validateFileComprehensively(
        file,
        apiClient,
        options,
        schemaContent,
        configContent
      );
      results.push(result);

      if (options.verbose) {
        displayValidationProgress(result, file);
      }
    }

    return results;
  });
}

/**
 * Validate a single file with comprehensive checks
 */
async function validateFileComprehensively(
  filePath: string,
  apiClient: ApiClient,
  options: ValidateOptions,
  schemaContent?: string,
  configContent?: string
): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');

    // Combine content with schema and config if provided
    let fullContent = content;

    if (schemaContent) {
      fullContent = `${schemaContent}\n\n${fullContent}`;
    }

    if (configContent) {
      fullContent = `${fullContent}\n\n${configContent}`;
    }

    // Perform multiple validation types
    const validationTasks = [];

    // 1. Basic CUE syntax validation
    validationTasks.push(
      apiClient
        .validate(fullContent, { strict: options.strict })
        .then(result => ({ type: 'syntax', result }))
    );

    // 2. Best practices validation (if enabled)
    if (options.bestPractices !== false) {
      validationTasks.push(
        apiClient
          .validateBestPractices?.(fullContent)
          ?.then(result => ({ type: 'bestPractices', result })) ||
          Promise.resolve({
            type: 'bestPractices',
            result: { success: true, data: { valid: true, errors: [], warnings: [] } },
          })
      );
    }

    // 3. Custom rules validation (if specified)
    if (options.rules && options.rules.length > 0) {
      validationTasks.push(
        apiClient
          .validateCustomRules?.(fullContent, options.rules)
          ?.then(result => ({ type: 'customRules', result })) ||
          Promise.resolve({
            type: 'customRules',
            result: { success: true, data: { valid: true, errors: [], warnings: [] } },
          })
      );
    }

    // 4. Project consistency validation
    validationTasks.push(
      apiClient
        .validateProjectConsistency?.(fullContent)
        ?.then(result => ({ type: 'consistency', result })) ||
        Promise.resolve({
          type: 'consistency',
          result: { success: true, data: { valid: true, errors: [], warnings: [] } },
        })
    );

    // Execute all validation tasks
    const validationResults = await Promise.all(validationTasks);

    // Combine results
    return combineValidationResults(validationResults, filePath, options, startTime);
  } catch (error) {
    return {
      file: path.basename(filePath),
      status: 'error',
      errors: [
        {
          line: 0,
          column: 0,
          message: error instanceof Error ? error.message : String(error),
          severity: 'error' as const,
          category: 'system',
        },
      ],
      warnings: [],
      suggestions: [],
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Combine validation results from multiple validation types
 */
function combineValidationResults(
  validationResults: any[],
  filePath: string,
  options: ValidateOptions,
  startTime: number
): ValidationResult {
  let overallValid = true;
  let allErrors: any[] = [];
  let allWarnings: any[] = [];
  let allSuggestions: any[] = [];

  for (const { type, result } of validationResults) {
    if (!result.success) {
      overallValid = false;
      allErrors.push({
        line: 0,
        column: 0,
        message: result.error || `${type} validation failed`,
        severity: 'error' as const,
        category: type,
      });
      continue;
    }

    const data = result.data;
    if (!data.valid) {
      overallValid = false;
    }

    if (data.errors) {
      allErrors.push(
        ...data.errors.map((err: any) => ({
          ...err,
          category: err.category || type,
          type,
        }))
      );
    }

    if (data.warnings && !options.skipWarnings) {
      allWarnings.push(
        ...data.warnings.map((warn: any) => ({
          ...warn,
          category: warn.category || type,
          type,
        }))
      );
    }

    if (data.suggestions) {
      allSuggestions.push(
        ...data.suggestions.map((sugg: any) => ({
          ...sugg,
          category: sugg.category || type,
          type,
        }))
      );
    }
  }

  // In strict mode, treat warnings as errors
  if (options.strict && allWarnings.length > 0) {
    allWarnings.forEach(warning => {
      allErrors.push({
        ...warning,
        severity: 'error' as const,
      });
    });
    overallValid = false;
  }

  return {
    file: path.basename(filePath),
    status: overallValid ? 'valid' : 'invalid',
    errors: allErrors,
    warnings: options.strict ? [] : allWarnings,
    suggestions: allSuggestions,
    processingTime: Date.now() - startTime,
    metadata: {
      validationTypes: validationResults.map(r => r.type),
      comprehensive: true,
    },
  };
}

/**
 * Display comprehensive validation results
 */
function displayComprehensiveResults(
  results: ValidationResult[],
  options: ValidateOptions,
  config: CLIConfig
): void {
  // Calculate overall statistics
  const totalFiles = results.length;
  const validFiles = results.filter(r => r.status === 'valid').length;
  const invalidFiles = results.filter(r => r.status === 'invalid').length;
  const errorFiles = results.filter(r => r.status === 'error').length;

  const totalErrors = results.reduce((sum, r) => sum + (r.errors?.length || 0), 0);
  const totalWarnings = results.reduce((sum, r) => sum + (r.warnings?.length || 0), 0);
  const totalSuggestions = results.reduce((sum, r) => sum + (r.suggestions?.length || 0), 0);

  // Overall status
  const overallValid = invalidFiles === 0 && errorFiles === 0;
  const status = overallValid ? 'VALID' : 'INVALID';
  const statusColor = overallValid ? chalk.green : chalk.red;
  const statusIcon = overallValid ? '✓' : '✗';

  console.log(`\n${statusIcon} Overall Status: ${statusColor(status)}\n`);

  // Summary statistics
  console.log(chalk.bold('Validation Summary:'));
  console.log(`  Files Processed: ${totalFiles}`);
  console.log(`  Valid: ${chalk.green(validFiles)}`);
  console.log(`  Invalid: ${invalidFiles > 0 ? chalk.red(invalidFiles) : invalidFiles}`);
  console.log(`  Errors: ${errorFiles > 0 ? chalk.red(errorFiles) : errorFiles}`);
  console.log(`  Total Issues: ${totalErrors + totalWarnings}`);
  console.log(`  Errors: ${totalErrors > 0 ? chalk.red(totalErrors) : totalErrors}`);
  console.log(`  Warnings: ${totalWarnings > 0 ? chalk.yellow(totalWarnings) : totalWarnings}`);
  console.log(
    `  Suggestions: ${totalSuggestions > 0 ? chalk.blue(totalSuggestions) : totalSuggestions}`
  );
  console.log();

  // Validation types performed
  const validationTypes = [...new Set(results.flatMap(r => r.metadata?.validationTypes || []))];

  if (validationTypes.length > 0) {
    console.log(chalk.bold('Validation Types:'));
    validationTypes.forEach((type: string) => {
      console.log(`  • ${formatValidationType(type)}`);
    });
    console.log();
  }

  // Show table
  console.log(formatValidationTable(results));

  // Show detailed errors if present
  if (options.verbose || totalErrors > 0) {
    const errorDetails = formatErrorDetails(results);
    if (errorDetails) {
      console.log(errorDetails);
    }
  }

  // Show warnings if verbose and not in strict mode
  if (options.verbose && !options.strict && totalWarnings > 0) {
    const warningDetails = formatWarningDetails(results);
    if (warningDetails) {
      console.log(warningDetails);
    }
  }

  // Show suggestions if present
  if (totalSuggestions > 0) {
    console.log(chalk.blue.bold('\nSuggestions:'));
    displaySuggestions(results);
    console.log();
  }

  // Show summary
  console.log(formatSummary(results));

  // Show strict mode note if enabled
  if (options.strict) {
    console.log(chalk.dim('\nNote: Running in strict mode (warnings treated as errors)'));
  }

  // Show fixable issues hint
  const fixableIssues = results.reduce((sum, r) => {
    const fixableErrors = r.errors?.filter(err => err.fixable).length || 0;
    const fixableWarnings = r.warnings?.filter(warn => warn.fixable).length || 0;
    return sum + fixableErrors + fixableWarnings;
  }, 0);

  if (fixableIssues > 0) {
    console.log(chalk.cyan(`\n💡 ${fixableIssues} issues can be automatically fixed`));
    console.log(chalk.gray('   Run: arbiter fix --auto to apply automatic fixes'));
  }
}

/**
 * Format validation type for display
 */
function formatValidationType(type: string): string {
  switch (type) {
    case 'syntax':
      return 'CUE Syntax Validation';
    case 'bestPractices':
      return 'Best Practices Check';
    case 'customRules':
      return 'Custom Rules Validation';
    case 'consistency':
      return 'Project Consistency Check';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

/**
 * Display suggestions from validation results
 */
function displaySuggestions(results: ValidationResult[]): void {
  const allSuggestions = results.flatMap(r =>
    (r.suggestions || []).map(s => ({ ...s, file: r.file }))
  );

  // Group by file
  const groupedSuggestions: Record<string, any[]> = {};

  for (const suggestion of allSuggestions) {
    const key = suggestion.file || 'general';
    if (!groupedSuggestions[key]) {
      groupedSuggestions[key] = [];
    }
    groupedSuggestions[key].push(suggestion);
  }

  for (const [file, fileSuggestions] of Object.entries(groupedSuggestions)) {
    console.log(chalk.blue(`  ${file}:`));

    for (const suggestion of fileSuggestions) {
      const location = suggestion.line
        ? `:${suggestion.line}${suggestion.column ? `:${suggestion.column}` : ''}`
        : '';
      const validationType = suggestion.type ? chalk.gray(`[${suggestion.type}]`) : '';

      console.log(`    💡 ${suggestion.message}${location} ${validationType}`);

      if (suggestion.fix) {
        console.log(chalk.gray(`      Suggested fix: ${suggestion.fix}`));
      }
    }
  }
}
