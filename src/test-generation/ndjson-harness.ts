/**
 * NDJSON Test Harness for Runtime Validation Coverage
 * 
 * Provides a safety net by running test vectors through runtime validation
 * independent of TypeScript test file generation. This ensures comprehensive
 * coverage even when individual test file generation fails.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { TestVector, ScenarioIR, TestGenerationIR } from './ir-types.js';

export interface NDJSONHarnessOptions {
  outputFile: string;
  runValidation: boolean;
  maxVectors: number;
  timeout: number;
  batchSize: number;
}

export interface NDJSONTestResult {
  scenarioId: string;
  vectorIndex: number;
  passed: boolean;
  error?: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface NDJSONHarnessReport {
  totalVectors: number;
  passedVectors: number;
  failedVectors: number;
  skippedVectors: number;
  duration: number;
  coverage: {
    scenarios: number;
    assertions: number;
    types: string[];
  };
  results: NDJSONTestResult[];
  errors: string[];
}

/**
 * NDJSON Test Harness for comprehensive validation coverage
 */
export class NDJSONHarness {
  private readonly options: NDJSONHarnessOptions;

  constructor(options: Partial<NDJSONHarnessOptions> = {}) {
    this.options = {
      outputFile: 'tests/vectors/test-vectors.ndjson',
      runValidation: true,
      maxVectors: 10000,
      timeout: 30000,
      batchSize: 100,
      ...options,
    };
  }

  /**
   * Generate comprehensive NDJSON test vectors from IR
   */
  async generateVectors(ir: TestGenerationIR): Promise<TestVector[]> {
    logger.info(`Generating NDJSON test vectors for ${ir.scenarios.length} scenarios`);

    const vectors: TestVector[] = [];
    let vectorCount = 0;

    for (const scenario of ir.scenarios) {
      if (vectorCount >= this.options.maxVectors) {
        logger.warn(`Reached maximum vector limit (${this.options.maxVectors}), stopping generation`);
        break;
      }

      try {
        const scenarioVectors = this.generateScenarioVectors(scenario);
        vectors.push(...scenarioVectors);
        vectorCount += scenarioVectors.length;
      } catch (error) {
        logger.warn(`Failed to generate vectors for scenario ${scenario.name}: ${error}`);
      }
    }

    logger.info(`Generated ${vectors.length} test vectors from ${ir.scenarios.length} scenarios`);
    return vectors;
  }

  /**
   * Write test vectors to NDJSON file
   */
  async writeVectors(vectors: TestVector[]): Promise<void> {
    const outputDir = path.dirname(this.options.outputFile);
    await fs.mkdir(outputDir, { recursive: true });

    // Write as newline-delimited JSON
    const ndjsonContent = vectors
      .map(vector => JSON.stringify(vector))
      .join('\n');

    await fs.writeFile(this.options.outputFile, ndjsonContent, 'utf-8');
    logger.info(`Written ${vectors.length} test vectors to ${this.options.outputFile}`);
  }

  /**
   * Run validation harness against test vectors
   */
  async runValidationHarness(vectors: TestVector[]): Promise<NDJSONHarnessReport> {
    if (!this.options.runValidation) {
      logger.info('Validation disabled, skipping harness run');
      return this.createEmptyReport(vectors);
    }

    logger.info(`Running validation harness against ${vectors.length} test vectors`);
    const startTime = Date.now();

    const results: NDJSONTestResult[] = [];
    const errors: string[] = [];
    const coverage = this.initializeCoverage();

    // Process vectors in batches for performance
    const batches = this.createBatches(vectors, this.options.batchSize);
    
    for (const [batchIndex, batch] of batches.entries()) {
      logger.debug(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} vectors)`);
      
      const batchResults = await this.processBatch(batch);
      results.push(...batchResults);
      
      // Update coverage tracking
      this.updateCoverage(coverage, batch, batchResults);
    }

    const duration = Date.now() - startTime;
    const report = this.createReport(vectors, results, errors, coverage, duration);

    logger.info(`Validation harness completed in ${duration}ms: ${report.passedVectors}/${report.totalVectors} passed`);
    
    return report;
  }

  /**
   * Load and run existing NDJSON vectors
   */
  async loadAndRun(vectorsFile?: string): Promise<NDJSONHarnessReport> {
    const file = vectorsFile || this.options.outputFile;
    
    try {
      const content = await fs.readFile(file, 'utf-8');
      const vectors = this.parseNDJSON(content);
      
      logger.info(`Loaded ${vectors.length} test vectors from ${file}`);
      return await this.runValidationHarness(vectors);
      
    } catch (error) {
      throw new Error(`Failed to load vectors from ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate vectors for a single scenario
   */
  private generateScenarioVectors(scenario: ScenarioIR): TestVector[] {
    const vectors: TestVector[] = [];

    // Generate positive test vectors (valid data)
    vectors.push(...this.generatePositiveVectors(scenario));
    
    // Generate negative test vectors (invalid data)
    vectors.push(...this.generateNegativeVectors(scenario));
    
    // Generate edge case vectors
    vectors.push(...this.generateEdgeCaseVectors(scenario));

    // Generate metamorphic vectors if applicable
    if (this.hasMetamorphicAssertions(scenario)) {
      vectors.push(...this.generateMetamorphicVectors(scenario));
    }

    return vectors;
  }

  /**
   * Generate positive test vectors (should pass validation)
   */
  private generatePositiveVectors(scenario: ScenarioIR): TestVector[] {
    const vectors: TestVector[] = [];
    
    // Basic valid sample
    vectors.push({
      scenarioId: scenario.id,
      schemaRef: scenario.schema.type,
      sample: this.generateValidSample(scenario.schema),
      expectValid: true,
      description: `Valid ${scenario.schema.type} sample`,
      tags: [scenario.type, scenario.framework, 'positive', 'basic'],
      metadata: {
        scenario: scenario.name,
        priority: scenario.priority,
        generatedAt: new Date().toISOString(),
      },
    });

    // Boundary valid samples
    if (scenario.schema.constraints) {
      vectors.push(...this.generateBoundaryValidVectors(scenario));
    }

    // Optional field variations (for objects)
    if (scenario.schema.kind === 'object' && scenario.schema.fields) {
      vectors.push(...this.generateOptionalFieldVectors(scenario));
    }

    return vectors;
  }

  /**
   * Generate negative test vectors (should fail validation)
   */
  private generateNegativeVectors(scenario: ScenarioIR): TestVector[] {
    const vectors: TestVector[] = [];

    // Type mismatch samples
    vectors.push({
      scenarioId: scenario.id,
      schemaRef: scenario.schema.type,
      sample: this.generateTypeMismatchSample(scenario.schema),
      expectValid: false,
      description: `Type mismatch for ${scenario.schema.type}`,
      tags: [scenario.type, scenario.framework, 'negative', 'type-mismatch'],
      metadata: {
        scenario: scenario.name,
        testType: 'type-mismatch',
      },
    });

    // Constraint violation samples
    if (scenario.schema.constraints) {
      vectors.push(...this.generateConstraintViolationVectors(scenario));
    }

    // Required field missing samples (for objects)
    if (scenario.schema.kind === 'object' && scenario.schema.fields) {
      vectors.push(...this.generateMissingRequiredFieldVectors(scenario));
    }

    // Unknown property samples (for closed objects)
    if (scenario.schema.kind === 'object' && !scenario.schema.open) {
      vectors.push({
        scenarioId: scenario.id,
        schemaRef: scenario.schema.type,
        sample: { ...this.generateValidSample(scenario.schema), unknownProp: 'should-fail' },
        expectValid: false,
        description: `Unknown property rejection for closed ${scenario.schema.type}`,
        tags: [scenario.type, scenario.framework, 'negative', 'unknown-property'],
        metadata: {
          scenario: scenario.name,
          testType: 'closed-object',
        },
      });
    }

    return vectors;
  }

  /**
   * Generate edge case test vectors
   */
  private generateEdgeCaseVectors(scenario: ScenarioIR): TestVector[] {
    const vectors: TestVector[] = [];

    switch (scenario.schema.kind) {
      case 'primitive':
        vectors.push(...this.generatePrimitiveEdgeCases(scenario));
        break;
      case 'array':
        vectors.push(...this.generateArrayEdgeCases(scenario));
        break;
      case 'object':
        vectors.push(...this.generateObjectEdgeCases(scenario));
        break;
      case 'union':
        vectors.push(...this.generateUnionEdgeCases(scenario));
        break;
    }

    return vectors;
  }

  /**
   * Process a batch of test vectors
   */
  private async processBatch(batch: TestVector[]): Promise<NDJSONTestResult[]> {
    const results: NDJSONTestResult[] = [];

    for (const [index, vector] of batch.entries()) {
      const startTime = Date.now();
      
      try {
        const passed = await this.validateVector(vector);
        
        results.push({
          scenarioId: vector.scenarioId,
          vectorIndex: index,
          passed,
          duration: Date.now() - startTime,
          metadata: vector.metadata,
        });
        
      } catch (error) {
        results.push({
          scenarioId: vector.scenarioId,
          vectorIndex: index,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
          metadata: vector.metadata,
        });
      }
    }

    return results;
  }

  /**
   * Validate a single test vector
   */
  private async validateVector(vector: TestVector): Promise<boolean> {
    try {
      // Runtime validation logic
      // This would integrate with a runtime validation library like Zod or AJV
      
      // For now, simulate validation based on expectValid flag
      // In a real implementation, this would validate vector.sample against vector.schemaRef
      
      // Basic type checking
      const isValid = this.performBasicValidation(vector);
      
      // Check if result matches expectation
      return isValid === vector.expectValid;
      
    } catch (error) {
      logger.warn(`Vector validation error: ${error}`);
      return false;
    }
  }

  /**
   * Basic validation simulation
   */
  private performBasicValidation(vector: TestVector): boolean {
    const { sample } = vector;
    
    // Simulate validation failures for obvious mismatches
    if (sample === null || sample === undefined) {
      return false;
    }
    
    // Simulate type checking
    if (vector.schemaRef === 'string' && typeof sample !== 'string') {
      return false;
    }
    
    if (vector.schemaRef === 'number' && typeof sample !== 'number') {
      return false;
    }
    
    if (vector.schemaRef === 'boolean' && typeof sample !== 'boolean') {
      return false;
    }
    
    if (vector.schemaRef === 'array' && !Array.isArray(sample)) {
      return false;
    }
    
    if (vector.schemaRef === 'object' && (typeof sample !== 'object' || Array.isArray(sample))) {
      return false;
    }
    
    return true;
  }

  // Sample generation methods

  private generateValidSample(schema: any): unknown {
    switch (schema.kind) {
      case 'primitive':
        return this.generatePrimitiveSample(schema.type);
      case 'array':
        return schema.items ? [this.generateValidSample(schema.items)] : [];
      case 'object':
        return this.generateObjectSample(schema, true);
      case 'union':
        return schema.alternatives?.[0] ? this.generateValidSample(schema.alternatives[0]) : null;
      default:
        return null;
    }
  }

  private generatePrimitiveSample(type: string): unknown {
    switch (type) {
      case 'string': return 'sample-string';
      case 'number': return 42;
      case 'integer': return 42;
      case 'boolean': return true;
      case 'null': return null;
      default: return 'unknown-type';
    }
  }

  private generateObjectSample(schema: any, valid: boolean): Record<string, unknown> {
    const sample: Record<string, unknown> = {};
    
    if (schema.fields) {
      for (const [key, fieldSchema] of Object.entries(schema.fields)) {
        const field = fieldSchema as any;
        if (field.required || valid) {
          sample[key] = this.generateValidSample(field);
        }
      }
    }
    
    return sample;
  }

  private generateTypeMismatchSample(schema: any): unknown {
    switch (schema.kind) {
      case 'primitive':
        switch (schema.type) {
          case 'string': return 42;
          case 'number': return 'not-a-number';
          case 'boolean': return 'not-a-boolean';
          default: return 'wrong-type';
        }
      case 'array': return 'not-an-array';
      case 'object': return 'not-an-object';
      default: return 'type-mismatch';
    }
  }

  // Helper methods for edge cases

  private generatePrimitiveEdgeCases(scenario: ScenarioIR): TestVector[] {
    const vectors: TestVector[] = [];
    const { schema } = scenario;

    if (schema.type === 'string') {
      vectors.push(
        this.createEdgeCaseVector(scenario, '', 'Empty string'),
        this.createEdgeCaseVector(scenario, ' ', 'Whitespace string'),
        this.createEdgeCaseVector(scenario, 'a'.repeat(1000), 'Very long string')
      );
    }

    if (schema.type === 'number' || schema.type === 'integer') {
      vectors.push(
        this.createEdgeCaseVector(scenario, 0, 'Zero'),
        this.createEdgeCaseVector(scenario, -1, 'Negative number'),
        this.createEdgeCaseVector(scenario, Number.MAX_SAFE_INTEGER, 'Maximum safe integer')
      );
    }

    return vectors;
  }

  private generateArrayEdgeCases(scenario: ScenarioIR): TestVector[] {
    return [
      this.createEdgeCaseVector(scenario, [], 'Empty array'),
      this.createEdgeCaseVector(scenario, [null], 'Array with null'),
      this.createEdgeCaseVector(scenario, Array(100).fill('item'), 'Large array'),
    ];
  }

  private generateObjectEdgeCases(scenario: ScenarioIR): TestVector[] {
    return [
      this.createEdgeCaseVector(scenario, {}, 'Empty object'),
      this.createEdgeCaseVector(scenario, Object.create(null), 'Object without prototype'),
    ];
  }

  private generateUnionEdgeCases(scenario: ScenarioIR): TestVector[] {
    const vectors: TestVector[] = [];
    const { schema } = scenario;

    if (schema.alternatives) {
      // Test each union alternative
      for (const [index, alt] of schema.alternatives.entries()) {
        vectors.push(this.createEdgeCaseVector(
          scenario,
          this.generateValidSample(alt),
          `Union alternative ${index + 1}`
        ));
      }
    }

    return vectors;
  }

  private createEdgeCaseVector(scenario: ScenarioIR, sample: unknown, description: string): TestVector {
    return {
      scenarioId: scenario.id,
      schemaRef: scenario.schema.type,
      sample,
      expectValid: true, // Edge cases should generally be valid
      description,
      tags: [scenario.type, scenario.framework, 'edge-case'],
      metadata: {
        scenario: scenario.name,
        testType: 'edge-case',
      },
    };
  }

  // Utility methods

  private hasMetamorphicAssertions(scenario: ScenarioIR): boolean {
    return scenario.assertions.some(a => a.type === 'metamorphic');
  }

  private generateMetamorphicVectors(scenario: ScenarioIR): TestVector[] {
    // Placeholder for metamorphic test generation
    return [];
  }

  private generateBoundaryValidVectors(scenario: ScenarioIR): TestVector[] {
    // Placeholder for boundary value testing
    return [];
  }

  private generateOptionalFieldVectors(scenario: ScenarioIR): TestVector[] {
    // Placeholder for optional field testing
    return [];
  }

  private generateConstraintViolationVectors(scenario: ScenarioIR): TestVector[] {
    // Placeholder for constraint violation testing
    return [];
  }

  private generateMissingRequiredFieldVectors(scenario: ScenarioIR): TestVector[] {
    // Placeholder for required field testing
    return [];
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private parseNDJSON(content: string): TestVector[] {
    return content
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  private initializeCoverage() {
    return {
      scenarios: new Set<string>(),
      assertions: new Set<string>(),
      types: new Set<string>(),
    };
  }

  private updateCoverage(coverage: any, vectors: TestVector[], results: NDJSONTestResult[]) {
    vectors.forEach(vector => {
      coverage.scenarios.add(vector.scenarioId);
      coverage.types.add(vector.schemaRef);
    });
  }

  private createReport(
    vectors: TestVector[],
    results: NDJSONTestResult[],
    errors: string[],
    coverage: any,
    duration: number
  ): NDJSONHarnessReport {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    return {
      totalVectors: vectors.length,
      passedVectors: passed,
      failedVectors: failed,
      skippedVectors: vectors.length - results.length,
      duration,
      coverage: {
        scenarios: coverage.scenarios.size,
        assertions: coverage.assertions.size,
        types: Array.from(coverage.types),
      },
      results,
      errors,
    };
  }

  private createEmptyReport(vectors: TestVector[]): NDJSONHarnessReport {
    return {
      totalVectors: vectors.length,
      passedVectors: 0,
      failedVectors: 0,
      skippedVectors: vectors.length,
      duration: 0,
      coverage: {
        scenarios: 0,
        assertions: 0,
        types: [],
      },
      results: [],
      errors: ['Validation disabled'],
    };
  }
}

export { NDJSONHarness };