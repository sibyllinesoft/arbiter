/**
 * Live validation engine for CUE files with contract execution and dependency checking
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, access } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { 
  ValidationResult, 
  ValidationError, 
  ValidationStatus, 
  ValidationType, 
  ValidationEngineError, 
  FileSystemError 
} from './types.js';
import type { ContractEngine } from '../contracts/engine.js';
import type { ContractExecutionResult, ContractDefinition } from '../contracts/types.js';

const execAsync = promisify(exec);

export interface ValidatorOptions {
  readonly cueExecutablePath: string;
  readonly contractsPath: string;
  readonly timeout: number;
  readonly enableContracts: boolean;
  readonly enableDependencyCheck: boolean;
  readonly cueModuleRoot: string;
  readonly maxFileSize: number;
  readonly parallelValidations: number;
}

export class LiveValidator {
  private contractEngine: ContractEngine | null = null;
  private validationQueue = new Map<string, Promise<ValidationResult>>();
  private activeValidations = 0;
  
  private readonly defaultOptions: ValidatorOptions = {
    cueExecutablePath: 'cue',
    contractsPath: './contracts',
    timeout: 30000,
    enableContracts: true,
    enableDependencyCheck: true,
    cueModuleRoot: '.',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    parallelValidations: 4,
  };

  constructor(private readonly options: ValidatorOptions = {} as ValidatorOptions) {
    this.options = { ...this.defaultOptions, ...options };
    
    if (this.options.enableContracts) {
      this.initializeContractEngine();
    }
  }

  /**
   * Initialize contract engine if contracts are enabled
   */
  private async initializeContractEngine(): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { ContractEngine } = await import('../contracts/engine.js');
      this.contractEngine = new ContractEngine(
        this.options.cueExecutablePath,
        this.options.contractsPath
      );
    } catch (error) {
      console.warn('Failed to initialize contract engine:', error);
      this.contractEngine = null;
    }
  }

  /**
   * Validate a single file
   */
  async validateFile(filePath: string, dependencies: string[] = []): Promise<ValidationResult> {
    // Check if validation is already in progress for this file
    const existingValidation = this.validationQueue.get(filePath);
    if (existingValidation) {
      return existingValidation;
    }

    // Check parallel validation limit
    if (this.activeValidations >= this.options.parallelValidations) {
      // Queue the validation
      await this.waitForAvailableSlot();
    }

    const validationPromise = this.performValidation(filePath, dependencies);
    this.validationQueue.set(filePath, validationPromise);
    this.activeValidations++;

    try {
      const result = await validationPromise;
      return result;
    } finally {
      this.validationQueue.delete(filePath);
      this.activeValidations--;
    }
  }

  /**
   * Validate multiple files in batch
   */
  async validateBatch(
    filePaths: string[], 
    dependencies: Map<string, string[]> = new Map()
  ): Promise<ValidationResult[]> {
    const validationPromises = filePaths.map(filePath => 
      this.validateFile(filePath, dependencies.get(filePath) || [])
    );

    return Promise.all(validationPromises);
  }

  /**
   * Perform the actual validation for a file
   */
  private async performValidation(
    filePath: string, 
    dependencies: string[]
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const absolutePath = resolve(filePath);
    
    try {
      // Check file accessibility and size
      await this.validateFileAccess(absolutePath);
      
      // Determine validation types to run
      const validationTypes = this.determineValidationTypes(absolutePath);
      
      // Run validations in sequence
      let finalResult = this.createSuccessResult(absolutePath, startTime);
      
      for (const validationType of validationTypes) {
        const result = await this.runValidationType(
          absolutePath, 
          validationType, 
          dependencies
        );
        
        finalResult = this.mergeValidationResults(finalResult, result);
        
        // Stop on critical errors
        if (result.status === 'error' && this.hasCriticalErrors([...result.errors])) {
          break;
        }
      }

      return finalResult;

    } catch (error) {
      return this.createErrorResult(
        absolutePath,
        startTime,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Validate file access and constraints
   */
  private async validateFileAccess(filePath: string): Promise<void> {
    try {
      await access(filePath);
      
      const stats = await import('fs/promises').then(fs => fs.stat(filePath));
      if (stats.size > this.options.maxFileSize) {
        throw new FileSystemError(
          `File too large: ${stats.size} bytes (max: ${this.options.maxFileSize})`,
          'file-size-check',
          filePath
        );
      }
    } catch (error) {
      throw new FileSystemError(
        `File access validation failed: ${error instanceof Error ? error.message : String(error)}`,
        'file-access',
        filePath
      );
    }
  }

  /**
   * Determine which validation types to run for a file
   */
  private determineValidationTypes(filePath: string): ValidationType[] {
    const types: ValidationType[] = [];
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    // Always check syntax first
    types.push('syntax');
    
    // Add semantic validation for CUE files
    if (ext === 'cue') {
      types.push('semantic');
      
      // Add schema validation if it looks like a schema file
      if (filePath.includes('schema') || filePath.includes('_schema')) {
        types.push('schema');
      }
    }
    
    // Add contract validation if enabled and contracts exist
    if (this.options.enableContracts && this.contractEngine) {
      types.push('contract');
    }
    
    // Add dependency validation if enabled
    if (this.options.enableDependencyCheck) {
      types.push('dependency');
    }
    
    return types;
  }

  /**
   * Run a specific validation type
   */
  private async runValidationType(
    filePath: string, 
    validationType: ValidationType, 
    dependencies: string[]
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      switch (validationType) {
        case 'syntax':
          return await this.validateSyntax(filePath, startTime);
          
        case 'semantic':
          return await this.validateSemantics(filePath, startTime);
          
        case 'contract':
          return await this.validateContracts(filePath, startTime);
          
        case 'schema':
          return await this.validateSchema(filePath, startTime);
          
        case 'dependency':
          return await this.validateDependencies(filePath, dependencies, startTime);
          
        default:
          throw new ValidationEngineError(
            `Unsupported validation type: ${validationType}`,
            filePath,
            validationType
          );
      }
    } catch (error) {
      return this.createErrorResult(
        filePath,
        startTime,
        error instanceof Error ? error : new Error(String(error)),
        validationType
      );
    }
  }

  /**
   * Validate CUE syntax
   */
  private async validateSyntax(filePath: string, startTime: number): Promise<ValidationResult> {
    try {
      const { stdout, stderr } = await Promise.race([
        execAsync(`${this.options.cueExecutablePath} fmt --check "${filePath}"`, {
          cwd: this.options.cueModuleRoot,
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Syntax validation timeout')), this.options.timeout)
        ),
      ]);

      const errors = this.parseCueErrors(stderr, 'syntax');
      const status = errors.filter(e => e.severity === 'error').length > 0 ? 'error' : 'success';

      return {
        filePath,
        status,
        validationType: 'syntax',
        errors: errors.filter(e => e.severity === 'error'),
        warnings: errors.filter(e => e.severity === 'warning'),
        info: errors.filter(e => e.severity === 'info'),
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const errors = this.parseCueErrors(
        error instanceof Error && 'stderr' in error ? String(error.stderr) : String(error), 
        'syntax'
      );

      return {
        filePath,
        status: 'error',
        validationType: 'syntax',
        errors: errors.length > 0 ? errors : [{
          type: 'syntax',
          severity: 'error',
          message: error instanceof Error ? error.message : String(error),
        }],
        warnings: [],
        info: [],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Validate CUE semantics
   */
  private async validateSemantics(filePath: string, startTime: number): Promise<ValidationResult> {
    try {
      const { stdout, stderr } = await Promise.race([
        execAsync(`${this.options.cueExecutablePath} vet "${filePath}"`, {
          cwd: this.options.cueModuleRoot,
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Semantic validation timeout')), this.options.timeout)
        ),
      ]);

      const errors = this.parseCueErrors(stderr, 'semantic');
      const status = errors.filter(e => e.severity === 'error').length > 0 ? 'error' : 'success';

      return {
        filePath,
        status,
        validationType: 'semantic',
        errors: errors.filter(e => e.severity === 'error'),
        warnings: errors.filter(e => e.severity === 'warning'),
        info: errors.filter(e => e.severity === 'info'),
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const errors = this.parseCueErrors(
        error instanceof Error && 'stderr' in error ? String(error.stderr) : String(error),
        'semantic'
      );

      return {
        filePath,
        status: 'error',
        validationType: 'semantic',
        errors: errors.length > 0 ? errors : [{
          type: 'semantic',
          severity: 'error',
          message: error instanceof Error ? error.message : String(error),
        }],
        warnings: [],
        info: [],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Validate using contracts
   */
  private async validateContracts(filePath: string, startTime: number): Promise<ValidationResult> {
    if (!this.contractEngine) {
      return this.createSkippedResult(filePath, 'contract', startTime, 'Contract engine not available');
    }

    try {
      // Check if this file contains contract definitions
      const content = await readFile(filePath, 'utf-8');
      const hasContracts = content.includes('Contract:') || content.includes('contract:');
      
      if (!hasContracts) {
        return this.createSkippedResult(filePath, 'contract', startTime, 'No contracts found in file');
      }

      // Parse and execute contracts
      const contract = await this.contractEngine.parseContractFromCue(filePath);
      const results = await this.contractEngine.executeContract(contract.id, {
        contractId: contract.id,
        functionName: 'validate',
        input: {},
        metadata: { filePath },
        startTime: new Date(),
      });

      const errors: ValidationError[] = [];
      const warnings: ValidationError[] = [];

      // Convert contract violations to validation errors
      for (const violation of results.violations) {
        const validationError: ValidationError = {
          type: 'contract',
          severity: violation.severity,
          message: violation.message,
          code: violation.conditionName,
          context: {
            violationType: violation.violationType,
            contractId: violation.contractId,
            input: violation.input,
            output: violation.output,
            expected: violation.expected,
            actual: violation.actual,
          },
        };

        if (violation.severity === 'error') {
          errors.push(validationError);
        } else if (violation.severity === 'warning') {
          warnings.push(validationError);
        }
      }

      const status: ValidationStatus = errors.length > 0 ? 'error' : 
                                      warnings.length > 0 ? 'warning' : 'success';

      return {
        filePath,
        status,
        validationType: 'contract',
        errors,
        warnings,
        info: [],
        duration: Date.now() - startTime,
        timestamp: new Date(),
        contractResults: [results],
      };

    } catch (error) {
      return {
        filePath,
        status: 'error',
        validationType: 'contract',
        errors: [{
          type: 'contract',
          severity: 'error',
          message: `Contract validation failed: ${error instanceof Error ? error.message : String(error)}`,
        }],
        warnings: [],
        info: [],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Validate schema definitions
   */
  private async validateSchema(filePath: string, startTime: number): Promise<ValidationResult> {
    try {
      // Use CUE's schema validation
      const { stdout, stderr } = await Promise.race([
        execAsync(`${this.options.cueExecutablePath} def "${filePath}"`, {
          cwd: this.options.cueModuleRoot,
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Schema validation timeout')), this.options.timeout)
        ),
      ]);

      // Parse the output to validate schema structure
      const errors: ValidationError[] = [];
      const warnings: ValidationError[] = [];

      if (stderr && stderr.trim()) {
        const parsedErrors = this.parseCueErrors(stderr, 'schema');
        errors.push(...parsedErrors.filter(e => e.severity === 'error'));
        warnings.push(...parsedErrors.filter(e => e.severity === 'warning'));
      }

      // Additional schema-specific validation
      const content = await readFile(filePath, 'utf-8');
      const schemaErrors = this.validateSchemaStructure(content, filePath);
      errors.push(...schemaErrors);

      const status: ValidationStatus = errors.length > 0 ? 'error' : 
                                      warnings.length > 0 ? 'warning' : 'success';

      return {
        filePath,
        status,
        validationType: 'schema',
        errors,
        warnings,
        info: [],
        duration: Date.now() - startTime,
        timestamp: new Date(),
        metadata: { schemaDefinitions: this.extractSchemaDefinitions(content) },
      };

    } catch (error) {
      return {
        filePath,
        status: 'error',
        validationType: 'schema',
        errors: [{
          type: 'schema',
          severity: 'error',
          message: `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
        }],
        warnings: [],
        info: [],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Validate file dependencies
   */
  private async validateDependencies(
    filePath: string, 
    dependencies: string[], 
    startTime: number
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const resolvedDependencies: string[] = [];

    for (const dep of dependencies) {
      try {
        const resolvedPath = resolve(dirname(filePath), dep);
        
        if (!existsSync(resolvedPath)) {
          // Try with common CUE extensions
          const extensions = ['', '.cue', '.json', '.yaml', '.yml'];
          let found = false;
          
          for (const ext of extensions) {
            const pathWithExt = resolvedPath + ext;
            if (existsSync(pathWithExt)) {
              resolvedDependencies.push(pathWithExt);
              found = true;
              break;
            }
          }
          
          if (!found) {
            errors.push({
              type: 'dependency',
              severity: 'error',
              message: `Dependency not found: ${dep}`,
              context: { dependency: dep, resolvedPath },
            });
          }
        } else {
          resolvedDependencies.push(resolvedPath);
          
          // Check if dependency is accessible
          try {
            await access(resolvedPath);
          } catch {
            warnings.push({
              type: 'dependency',
              severity: 'warning',
              message: `Dependency exists but may not be accessible: ${dep}`,
              context: { dependency: dep, resolvedPath },
            });
          }
        }
      } catch (error) {
        errors.push({
          type: 'dependency',
          severity: 'error',
          message: `Failed to resolve dependency: ${dep} - ${error instanceof Error ? error.message : String(error)}`,
          context: { dependency: dep },
        });
      }
    }

    const status: ValidationStatus = errors.length > 0 ? 'error' : 
                                    warnings.length > 0 ? 'warning' : 'success';

    return {
      filePath,
      status,
      validationType: 'dependency',
      errors,
      warnings,
      info: [],
      duration: Date.now() - startTime,
      timestamp: new Date(),
      dependencies: resolvedDependencies,
    };
  }

  /**
   * Parse CUE error output
   */
  private parseCueErrors(errorOutput: string, validationType: ValidationType): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!errorOutput || !errorOutput.trim()) {
      return errors;
    }

    // Common CUE error patterns
    const errorPatterns = [
      // Standard CUE error format: filename:line:column: message
      /^([^:]+):(\d+):(\d+):\s*(.+)$/,
      // Alternative format with error/warning prefix
      /^(error|warning|info):\s*([^:]+):(\d+):(\d+):\s*(.+)$/i,
      // Simple error format
      /^([^:]+):\s*(.+)$/,
    ];

    const lines = errorOutput.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      let matched = false;
      
      for (const pattern of errorPatterns) {
        const match = line.match(pattern);
        if (match) {
          matched = true;
          
          if (match.length >= 5) {
            // Full format with line/column
            const severity = match[1]?.toLowerCase() === 'warning' ? 'warning' :
                           match[1]?.toLowerCase() === 'info' ? 'info' : 'error';
            
            errors.push({
              type: validationType,
              severity: severity as 'error' | 'warning' | 'info',
              message: match[5] || match[4],
              line: parseInt(match[3] || match[2], 10),
              column: parseInt(match[4] || match[3], 10),
            });
          } else if (match.length >= 3) {
            // Simple format
            errors.push({
              type: validationType,
              severity: 'error',
              message: match[2],
            });
          }
          break;
        }
      }
      
      // If no pattern matched, treat as generic error
      if (!matched && line.trim()) {
        errors.push({
          type: validationType,
          severity: 'error',
          message: line.trim(),
        });
      }
    }

    return errors;
  }

  /**
   * Validate schema structure for CUE files
   */
  private validateSchemaStructure(content: string, filePath: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check for common schema issues
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      // Check for invalid field definitions
      if (line.includes(':') && line.includes('=') && !line.includes('==')) {
        const colonIndex = line.indexOf(':');
        const equalsIndex = line.indexOf('=');
        
        if (colonIndex < equalsIndex) {
          errors.push({
            type: 'schema',
            severity: 'warning',
            message: 'Potential field definition with assignment - consider using constraint instead',
            line: lineNumber,
            column: equalsIndex + 1,
          });
        }
      }
      
      // Check for unquoted field names with special characters
      const fieldMatch = line.match(/^\s*([^:\s]+):\s*/);
      if (fieldMatch && fieldMatch[1] && !fieldMatch[1].startsWith('"')) {
        const fieldName = fieldMatch[1];
        if (/[^a-zA-Z0-9_]/.test(fieldName)) {
          errors.push({
            type: 'schema',
            severity: 'warning',
            message: `Field name '${fieldName}' contains special characters and should be quoted`,
            line: lineNumber,
            column: 1,
          });
        }
      }
    }
    
    return errors;
  }

  /**
   * Extract schema definitions from content
   */
  private extractSchemaDefinitions(content: string): string[] {
    const definitions: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Look for top-level definitions
      const match = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
      if (match) {
        definitions.push(match[1]);
      }
    }
    
    return definitions;
  }

  /**
   * Wait for an available validation slot
   */
  private async waitForAvailableSlot(): Promise<void> {
    while (this.activeValidations >= this.options.parallelValidations) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Check if errors are critical (should stop further validation)
   */
  private hasCriticalErrors(errors: ValidationError[]): boolean {
    return errors.some(error => 
      error.severity === 'error' && 
      error.type === 'syntax' // Syntax errors are critical
    );
  }

  /**
   * Create a successful validation result
   */
  private createSuccessResult(filePath: string, startTime: number): ValidationResult {
    return {
      filePath,
      status: 'success',
      validationType: 'syntax', // Will be updated when merging
      errors: [],
      warnings: [],
      info: [],
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  /**
   * Create an error validation result
   */
  private createErrorResult(
    filePath: string, 
    startTime: number, 
    error: Error,
    validationType: ValidationType = 'syntax'
  ): ValidationResult {
    return {
      filePath,
      status: 'error',
      validationType,
      errors: [{
        type: validationType,
        severity: 'error',
        message: error.message,
      }],
      warnings: [],
      info: [],
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  /**
   * Create a skipped validation result
   */
  private createSkippedResult(
    filePath: string, 
    validationType: ValidationType, 
    startTime: number, 
    reason: string
  ): ValidationResult {
    return {
      filePath,
      status: 'skipped',
      validationType,
      errors: [],
      warnings: [],
      info: [{
        type: validationType,
        severity: 'info',
        message: `Validation skipped: ${reason}`,
      }],
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  /**
   * Merge multiple validation results
   */
  private mergeValidationResults(
    result1: ValidationResult, 
    result2: ValidationResult
  ): ValidationResult {
    const errors = [...result1.errors, ...result2.errors];
    const warnings = [...result1.warnings, ...result2.warnings];
    const info = [...result1.info, ...result2.info];
    
    const status: ValidationStatus = errors.length > 0 ? 'error' : 
                                    warnings.length > 0 ? 'warning' : 'success';
    
    return {
      filePath: result1.filePath,
      status,
      validationType: 'semantic', // Use most comprehensive type
      errors,
      warnings,
      info,
      duration: result1.duration + result2.duration,
      timestamp: new Date(),
      contractResults: [
        ...(result1.contractResults || []),
        ...(result2.contractResults || []),
      ],
      dependencies: [
        ...(result1.dependencies || []),
        ...(result2.dependencies || []),
      ],
      metadata: {
        ...result1.metadata,
        ...result2.metadata,
      },
    };
  }

  /**
   * Get current validation statistics
   */
  getStats() {
    return {
      activeValidations: this.activeValidations,
      queuedValidations: this.validationQueue.size,
      contractEngineAvailable: this.contractEngine !== null,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.validationQueue.clear();
    this.contractEngine = null;
  }
}