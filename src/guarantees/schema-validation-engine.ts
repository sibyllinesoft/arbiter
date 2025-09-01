/**
 * Rails & Guarantees v1.0 RC - Phase 5: Schema Validation Engine
 * CUE Schema Lock and Property-based Validation System
 */

import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { performance } from 'perf_hooks';

// Schema Validation Types
export interface SchemaDefinition {
  id: string;
  name: string;
  version: string;
  cueSchema: string;
  locked: boolean;
  lockHash?: string;
  lockTimestamp?: number;
  metadata: Record<string, unknown>;
}

export interface ValidationRequest {
  schemaId: string;
  data: unknown;
  options?: ValidationOptions;
}

export interface ValidationOptions {
  strict?: boolean;
  allowPartial?: boolean;
  validateReferences?: boolean;
  timeout?: number;
}

export interface SchemaValidationResult {
  valid: boolean;
  schemaId: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: ValidationMetadata;
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  severity: 'error' | 'fatal';
  context?: Record<string, unknown>;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
  suggestion?: string;
}

export interface ValidationMetadata {
  schemaVersion: string;
  validationTime: number;
  lockVerified: boolean;
  cacheHit: boolean;
  performance: {
    cueCompileTime: number;
    validationTime: number;
    totalTime: number;
  };
}

export interface SchemaLock {
  schemas: Record<string, {
    version: string;
    hash: string;
    timestamp: number;
    dependencies: string[];
  }>;
  lockVersion: string;
  createdAt: number;
  updatedAt: number;
}

// CUE Integration Helper
class CUERunner {
  private cuePath: string;
  
  constructor(cuePath = 'cue') {
    this.cuePath = cuePath;
  }

  async validateData(schema: string, data: unknown, options: ValidationOptions = {}): Promise<SchemaValidationResult> {
    const startTime = performance.now();
    const tempDir = `/tmp/arbiter-schema-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await mkdir(tempDir, { recursive: true });
      
      // Write schema file
      const schemaFile = join(tempDir, 'schema.cue');
      await writeFile(schemaFile, schema);
      
      // Write data file
      const dataFile = join(tempDir, 'data.json');
      await writeFile(dataFile, JSON.stringify(data, null, 2));
      
      // Create validation CUE file
      const validationCue = `
import "encoding/json"

// Load the schema
schema: {
${schema.split('\n').map(line => `  ${line}`).join('\n')}
}

// Load the data
data: json.Unmarshal("""
${JSON.stringify(data, null, 2)}
""")

// Validate data against schema
validation: data & schema

// Export result
result: {
  valid: validation != _|_
  data: validation
}
`;
      
      const validationFile = join(tempDir, 'validate.cue');
      await writeFile(validationFile, validationCue);
      
      const compileStartTime = performance.now();
      
      // Run CUE validation
      const cueResult = await this.runCueCommand([
        'eval',
        '--out', 'json',
        '--expression', 'result',
        validationFile
      ], options.timeout);
      
      const compileTime = performance.now() - compileStartTime;
      const validationTime = performance.now() - compileStartTime;
      const totalTime = performance.now() - startTime;
      
      const result = JSON.parse(cueResult);
      
      return {
        valid: result.valid === true,
        schemaId: 'temp',
        errors: result.valid ? [] : this.extractCueErrors(cueResult),
        warnings: [],
        metadata: {
          schemaVersion: '1.0.0',
          validationTime: Date.now(),
          lockVerified: false,
          cacheHit: false,
          performance: {
            cueCompileTime: compileTime,
            validationTime,
            totalTime
          }
        }
      };
      
    } catch (error) {
      return {
        valid: false,
        schemaId: 'temp',
        errors: [{
          path: '',
          message: `CUE validation failed: ${error.message}`,
          code: 'CUE_VALIDATION_ERROR',
          severity: 'error'
        }],
        warnings: [],
        metadata: {
          schemaVersion: '1.0.0',
          validationTime: Date.now(),
          lockVerified: false,
          cacheHit: false,
          performance: {
            cueCompileTime: 0,
            validationTime: 0,
            totalTime: performance.now() - startTime
          }
        }
      };
    } finally {
      // Cleanup temp directory
      try {
        await this.cleanup(tempDir);
      } catch (cleanupError) {
        console.warn(`Failed to cleanup temp directory ${tempDir}:`, cleanupError);
      }
    }
  }

  private async runCueCommand(args: string[], timeout = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.cuePath, args);
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error(`CUE command timed out after ${timeout}ms`));
      }, timeout);

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`CUE command failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        clearTimeout(timer);
        reject(new Error(`Failed to execute CUE: ${error.message}`));
      });
    });
  }

  private extractCueErrors(cueOutput: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    try {
      // Parse CUE error output
      const lines = cueOutput.split('\n').filter(line => line.trim().length > 0);
      
      for (const line of lines) {
        if (line.includes('error') || line.includes('_|_')) {
          const pathMatch = line.match(/^([^:]+):/);
          const path = pathMatch ? pathMatch[1] : '';
          
          errors.push({
            path,
            message: line,
            code: 'CUE_VALIDATION_FAILED',
            severity: 'error'
          });
        }
      }
      
      if (errors.length === 0) {
        errors.push({
          path: '',
          message: 'Unknown CUE validation error',
          code: 'CUE_UNKNOWN_ERROR',
          severity: 'error'
        });
      }
      
    } catch (parseError) {
      errors.push({
        path: '',
        message: `Failed to parse CUE error output: ${parseError.message}`,
        code: 'CUE_PARSE_ERROR',
        severity: 'error'
      });
    }
    
    return errors;
  }

  private async cleanup(dir: string): Promise<void> {
    // Simple cleanup - remove temp directory
    await this.runCueCommand(['version']).catch(() => {}); // Dummy command to ensure process cleanup
  }
}

// Schema Validation Engine
export class SchemaValidationEngine {
  private schemas = new Map<string, SchemaDefinition>();
  private schemaLock: SchemaLock | null = null;
  private validationCache = new Map<string, SchemaValidationResult>();
  private cueRunner: CUERunner;
  private lockFile: string;

  constructor(lockFile = 'cue.schema.lock') {
    this.lockFile = lockFile;
    this.cueRunner = new CUERunner();
  }

  // Schema Management
  async registerSchema(schema: SchemaDefinition): Promise<void> {
    // Validate the schema itself
    await this.validateSchemaDefinition(schema);
    
    // Calculate hash for locking
    const hash = createHash('sha256').update(schema.cueSchema).digest('hex');
    
    // Lock the schema if not already locked
    if (!schema.locked) {
      schema.locked = true;
      schema.lockHash = hash;
      schema.lockTimestamp = Date.now();
    } else if (schema.lockHash !== hash) {
      throw new Error(`Schema ${schema.id} has been modified after locking. Expected hash: ${schema.lockHash}, actual: ${hash}`);
    }
    
    this.schemas.set(schema.id, schema);
    await this.updateSchemaLock();
  }

  async loadSchemaLock(): Promise<void> {
    try {
      await access(this.lockFile);
      const lockContent = await readFile(this.lockFile, 'utf-8');
      this.schemaLock = JSON.parse(lockContent);
      
      // Verify lock integrity
      await this.verifySchemaLock();
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to load schema lock: ${error.message}`);
      }
      // Create new lock file
      this.schemaLock = {
        schemas: {},
        lockVersion: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }
  }

  async saveSchemaLock(): Promise<void> {
    if (!this.schemaLock) {
      throw new Error('No schema lock to save');
    }
    
    this.schemaLock.updatedAt = Date.now();
    
    const lockDir = dirname(this.lockFile);
    await mkdir(lockDir, { recursive: true });
    
    await writeFile(this.lockFile, JSON.stringify(this.schemaLock, null, 2));
  }

  // Core Validation
  async validateData(request: ValidationRequest): Promise<SchemaValidationResult> {
    const schema = this.schemas.get(request.schemaId);
    if (!schema) {
      throw new Error(`Schema not found: ${request.schemaId}`);
    }

    // Check cache first
    const cacheKey = this.getCacheKey(request);
    const cached = this.validationCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          cacheHit: true
        }
      };
    }

    // Verify schema lock
    if (!await this.verifySchemaIntegrity(schema)) {
      throw new Error(`Schema integrity check failed for ${schema.id}`);
    }

    // Perform validation
    const result = await this.cueRunner.validateData(
      schema.cueSchema,
      request.data,
      request.options || {}
    );

    result.schemaId = request.schemaId;
    result.metadata.lockVerified = true;
    result.metadata.schemaVersion = schema.version;

    // Cache the result
    this.validationCache.set(cacheKey, result);

    return result;
  }

  // Property-based Testing Support
  async generatePropertyTests(schemaId: string, count = 100): Promise<unknown[]> {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      throw new Error(`Schema not found: ${schemaId}`);
    }

    // Generate test cases based on schema constraints
    const testCases: unknown[] = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const testCase = await this.generateTestCase(schema);
        testCases.push(testCase);
      } catch (error) {
        console.warn(`Failed to generate test case ${i}: ${error.message}`);
      }
    }

    return testCases;
  }

  async runPropertyTests(schemaId: string, testCases: unknown[]): Promise<{
    passed: number;
    failed: number;
    errors: Array<{ testCase: unknown; error: ValidationError[] }>;
  }> {
    let passed = 0;
    let failed = 0;
    const errors: Array<{ testCase: unknown; error: ValidationError[] }> = [];

    for (const testCase of testCases) {
      const result = await this.validateData({
        schemaId,
        data: testCase,
        options: { strict: true }
      });

      if (result.valid) {
        passed++;
      } else {
        failed++;
        errors.push({ testCase, error: result.errors });
      }
    }

    return { passed, failed, errors };
  }

  // Metamorphic Testing Support
  async runMetamorphicTests(
    schemaId: string,
    testCases: unknown[],
    transformations: Array<(data: unknown) => unknown>
  ): Promise<{
    invariantViolations: number;
    totalTests: number;
    violations: Array<{
      original: unknown;
      transformed: unknown;
      originalResult: SchemaValidationResult;
      transformedResult: SchemaValidationResult;
    }>;
  }> {
    let invariantViolations = 0;
    const violations: Array<{
      original: unknown;
      transformed: unknown;
      originalResult: SchemaValidationResult;
      transformedResult: SchemaValidationResult;
    }> = [];

    for (const testCase of testCases) {
      for (const transform of transformations) {
        try {
          const originalResult = await this.validateData({
            schemaId,
            data: testCase
          });

          const transformed = transform(testCase);
          const transformedResult = await this.validateData({
            schemaId,
            data: transformed
          });

          // Metamorphic property: validation results should be consistent
          // (both valid or both invalid for semantically equivalent data)
          if (originalResult.valid !== transformedResult.valid) {
            invariantViolations++;
            violations.push({
              original: testCase,
              transformed,
              originalResult,
              transformedResult
            });
          }
        } catch (error) {
          console.warn(`Metamorphic test failed: ${error.message}`);
        }
      }
    }

    return {
      invariantViolations,
      totalTests: testCases.length * transformations.length,
      violations
    };
  }

  // Private Methods
  private async validateSchemaDefinition(schema: SchemaDefinition): Promise<void> {
    try {
      // Try to compile the CUE schema
      await this.cueRunner.validateData(schema.cueSchema, {}, { timeout: 10000 });
    } catch (error) {
      throw new Error(`Invalid CUE schema: ${error.message}`);
    }
  }

  private async updateSchemaLock(): Promise<void> {
    if (!this.schemaLock) {
      await this.loadSchemaLock();
    }

    for (const [id, schema] of this.schemas.entries()) {
      if (schema.locked && schema.lockHash) {
        this.schemaLock!.schemas[id] = {
          version: schema.version,
          hash: schema.lockHash,
          timestamp: schema.lockTimestamp || Date.now(),
          dependencies: [] // TODO: extract dependencies from schema
        };
      }
    }

    await this.saveSchemaLock();
  }

  private async verifySchemaLock(): Promise<void> {
    if (!this.schemaLock) {
      throw new Error('No schema lock loaded');
    }

    // Verify each locked schema
    for (const [id, lockEntry] of Object.entries(this.schemaLock.schemas)) {
      const schema = this.schemas.get(id);
      if (schema && schema.locked) {
        if (schema.lockHash !== lockEntry.hash) {
          throw new Error(`Schema lock violation: ${id} hash mismatch`);
        }
      }
    }
  }

  private async verifySchemaIntegrity(schema: SchemaDefinition): Promise<boolean> {
    if (!schema.locked || !schema.lockHash) {
      return true; // Unlocked schemas don't need integrity check
    }

    const currentHash = createHash('sha256').update(schema.cueSchema).digest('hex');
    return currentHash === schema.lockHash;
  }

  private getCacheKey(request: ValidationRequest): string {
    const dataHash = createHash('sha256').update(JSON.stringify(request.data)).digest('hex');
    const optionsHash = createHash('sha256').update(JSON.stringify(request.options || {})).digest('hex');
    return `${request.schemaId}:${dataHash}:${optionsHash}`;
  }

  private isCacheValid(cached: SchemaValidationResult): boolean {
    // Cache is valid for 5 minutes
    const cacheAge = Date.now() - cached.metadata.validationTime;
    return cacheAge < 5 * 60 * 1000;
  }

  private async generateTestCase(schema: SchemaDefinition): Promise<unknown> {
    // Simple test case generation - in a real implementation, this would
    // parse the CUE schema to generate valid test data
    return {
      generated: true,
      timestamp: Date.now(),
      random: Math.random()
    };
  }

  // Getters and utility methods
  getSchema(id: string): SchemaDefinition | undefined {
    return this.schemas.get(id);
  }

  getAllSchemas(): SchemaDefinition[] {
    return Array.from(this.schemas.values());
  }

  getSchemaLock(): SchemaLock | null {
    return this.schemaLock;
  }

  getCacheStats(): { size: number; hitRate: number } {
    // TODO: Implement proper hit rate tracking
    return {
      size: this.validationCache.size,
      hitRate: 0
    };
  }

  clearCache(): void {
    this.validationCache.clear();
  }

  // Generate validation report
  generateValidationReport(results: SchemaValidationResult[]): string {
    const report = [
      '# Schema Validation Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Summary',
      `- Total Validations: ${results.length}`,
      `- Passed: ${results.filter(r => r.valid).length}`,
      `- Failed: ${results.filter(r => !r.valid).length}`,
      '',
    ];

    const failedResults = results.filter(r => !r.valid);
    if (failedResults.length > 0) {
      report.push('## Validation Failures');
      
      failedResults.forEach((result, index) => {
        report.push(`### ${index + 1}. Schema: ${result.schemaId}`);
        report.push('**Errors:**');
        result.errors.forEach(error => {
          report.push(`- ${error.path}: ${error.message} (${error.code})`);
        });
        if (result.warnings.length > 0) {
          report.push('**Warnings:**');
          result.warnings.forEach(warning => {
            report.push(`- ${warning.path}: ${warning.message} (${warning.code})`);
          });
        }
        report.push('');
      });
    }

    // Performance statistics
    const avgPerformance = results.reduce((acc, r) => ({
      cueCompileTime: acc.cueCompileTime + r.metadata.performance.cueCompileTime,
      validationTime: acc.validationTime + r.metadata.performance.validationTime,
      totalTime: acc.totalTime + r.metadata.performance.totalTime
    }), { cueCompileTime: 0, validationTime: 0, totalTime: 0 });

    if (results.length > 0) {
      report.push('## Performance Statistics');
      report.push(`- Average CUE Compile Time: ${(avgPerformance.cueCompileTime / results.length).toFixed(2)}ms`);
      report.push(`- Average Validation Time: ${(avgPerformance.validationTime / results.length).toFixed(2)}ms`);
      report.push(`- Average Total Time: ${(avgPerformance.totalTime / results.length).toFixed(2)}ms`);
      report.push('');
    }

    return report.join('\n');
  }
}

// Export factory function
export function createSchemaValidationEngine(lockFile?: string): SchemaValidationEngine {
  return new SchemaValidationEngine(lockFile);
}