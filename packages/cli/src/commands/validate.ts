import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { ApiClient } from '../api-client.js';
import { 
  formatValidationTable, 
  formatErrorDetails, 
  formatWarningDetails, 
  formatSummary,
  formatJson 
} from '../utils/formatting.js';
import { withProgress } from '../utils/progress.js';
import type { ValidateOptions, CLIConfig, ValidationResult } from '../types.js';

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
    if (files.length === 0) {
      console.error(chalk.red('No files specified for validation'));
      return 1;
    }

    // Resolve file paths
    const resolvedFiles = await resolveFiles(files, config.projectDir);
    
    if (resolvedFiles.length === 0) {
      console.error(chalk.red('No valid files found'));
      return 1;
    }

    console.log(chalk.dim(`Validating ${resolvedFiles.length} files`));

    // Load schema if specified
    let schemaContent: string | undefined;
    if (options.schema) {
      try {
        schemaContent = await fs.readFile(options.schema, 'utf-8');
      } catch (error) {
        console.error(chalk.red(`Cannot read schema file: ${options.schema}`));
        return 1;
      }
    }

    // Load config if specified
    let configContent: string | undefined;
    if (options.config) {
      try {
        configContent = await fs.readFile(options.config, 'utf-8');
      } catch (error) {
        console.error(chalk.red(`Cannot read config file: ${options.config}`));
        return 1;
      }
    }

    // Validate files
    const results = await validateFiles(
      resolvedFiles, 
      config, 
      options, 
      schemaContent, 
      configContent
    );

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
    console.error(chalk.red('Validate command failed:'), error instanceof Error ? error.message : String(error));
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
        const cueFiles = dirFiles
          .filter(f => f.endsWith('.cue'))
          .map(f => path.join(fullPath, f));
        resolved.push(...cueFiles);
      }
    } catch (error) {
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
  const apiClient = new ApiClient(config);
  const results: ValidationResult[] = [];
  
  // Check server health first
  const healthCheck = await apiClient.health();
  if (!healthCheck.success) {
    throw new Error(`Cannot connect to Arbiter server: ${healthCheck.error}`);
  }

  return withProgress(
    { text: `Validating ${files.length} files...`, color: 'blue' },
    async () => {
      for (const file of files) {
        const result = await validateSingleFile(
          file, 
          apiClient, 
          options, 
          schemaContent, 
          configContent
        );
        results.push(result);

        if (options.verbose) {
          const status = result.status === 'valid' ? chalk.green('✓') : 
                       result.status === 'invalid' ? chalk.red('✗') : 
                       chalk.yellow('!');
          console.log(`${status} ${path.basename(file)}`);
        }
      }

      return results;
    }
  );
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
    
    // Process errors
    const errors = data.errors?.map(error => ({
      line: error.line || 0,
      column: error.column || 0,
      message: error.message,
      severity: 'error' as const,
      category: 'validation',
    })) || [];

    // Process warnings
    const warnings = data.warnings?.map(warning => ({
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
  options: ValidateOptions,
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