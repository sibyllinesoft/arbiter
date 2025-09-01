/**
 * Contract test runner with parallel execution and comprehensive reporting
 */

import * as fc from 'fast-check';
import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../utils/logger.js';
import {
  ContractTestSuite,
  GeneratedProperty,
  PropertyTestResult,
  PropertyTestConfig,
  ContractViolation,
  ViolationReport,
  ViolationSummary,
  ContractMetrics,
  ContractError,
  ContractExecutionError
} from './types.js';

export interface TestRunConfig {
  parallel?: boolean;
  maxConcurrency?: number;
  timeout?: number;
  saveResults?: boolean;
  resultsPath?: string;
}

export interface TestRunResult {
  contractId: string;
  success: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  propertyResults: Map<string, PropertyTestResult>;
  violations: ContractViolation[];
  metrics: ContractMetrics;
}

export interface TestReport {
  id: string;
  contractId: string;
  timestamp: Date;
  result: TestRunResult;
  config: TestRunConfig;
  environment: {
    nodeVersion: string;
    platform: string;
    cpuCount: number;
    memory: string;
  };
}

export class ContractTestRunner {
  private readonly defaultConfig: TestRunConfig = {
    parallel: true,
    maxConcurrency: Math.max(1, cpus().length - 1),
    timeout: 30000,
    saveResults: true,
    resultsPath: './test-results/contracts',
  };

  private testSuites = new Map<string, ContractTestSuite>();
  private runningTests = new Set<string>();

  constructor(private config: Partial<TestRunConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Save test suite for later execution
   */
  async saveTestSuite(testSuite: ContractTestSuite): Promise<void> {
    try {
      this.testSuites.set(testSuite.contractId, testSuite);
      
      if (this.config.saveResults && this.config.resultsPath) {
        await this.ensureResultsDirectory();
        const suitePath = join(this.config.resultsPath, `${testSuite.contractId}-suite.json`);
        
        const serializableSuite = {
          contractId: testSuite.contractId,
          properties: testSuite.properties.map(prop => ({
            name: prop.name,
            description: prop.description,
            type: prop.type,
            shrinkable: prop.shrinkable,
            // Note: arbitraries and predicates are not serializable
          })),
          config: testSuite.config,
        };
        
        await writeFile(suitePath, JSON.stringify(serializableSuite, null, 2));
        logger.debug(`Saved test suite for ${testSuite.contractId} to ${suitePath}`);
      }
    } catch (error) {
      logger.error(`Failed to save test suite for ${testSuite.contractId}:`, error);
      throw new ContractError(
        `Test suite save failed: ${error instanceof Error ? error.message : String(error)}`,
        testSuite.contractId,
        'test-save',
        { originalError: error }
      );
    }
  }

  /**
   * Run contract tests with parallel execution
   */
  async runContractTests(
    contractId: string,
    runConfig: Partial<TestRunConfig> = {}
  ): Promise<TestRunResult> {
    const config = { ...this.config, ...runConfig };
    const startTime = Date.now();

    try {
      logger.info(`Starting contract tests for: ${contractId}`);

      if (this.runningTests.has(contractId)) {
        throw new ContractExecutionError(
          `Tests already running for contract: ${contractId}`,
          contractId,
          { runningTests: Array.from(this.runningTests) }
        );
      }

      this.runningTests.add(contractId);

      const testSuite = this.testSuites.get(contractId);
      if (!testSuite) {
        throw new ContractExecutionError(
          `Test suite not found for contract: ${contractId}`,
          contractId
        );
      }

      // Execute property tests
      const propertyResults = config.parallel
        ? await this.runPropertiesParallel(testSuite, config)
        : await this.runPropertiesSequential(testSuite, config);

      // Analyze results
      const result = await this.analyzeTestResults(contractId, propertyResults, Date.now() - startTime);

      // Generate and save report
      if (config.saveResults) {
        await this.saveTestReport(contractId, result, config);
      }

      logger.info(`Contract tests completed for ${contractId}:`, {
        duration: result.duration,
        success: result.success,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
      });

      return result;

    } catch (error) {
      logger.error(`Contract test execution failed for ${contractId}:`, error);
      throw error;
    } finally {
      this.runningTests.delete(contractId);
    }
  }

  /**
   * Run all available contract tests
   */
  async runAllContractTests(config: Partial<TestRunConfig> = {}): Promise<Map<string, TestRunResult>> {
    const results = new Map<string, TestRunResult>();
    const finalConfig = { ...this.config, ...config };

    logger.info(`Running tests for ${this.testSuites.size} contracts`);

    if (finalConfig.parallel) {
      // Run contracts in parallel with concurrency limit
      const contractIds = Array.from(this.testSuites.keys());
      const concurrency = finalConfig.maxConcurrency || 4;
      
      for (let i = 0; i < contractIds.length; i += concurrency) {
        const batch = contractIds.slice(i, i + concurrency);
        const batchPromises = batch.map(contractId => 
          this.runContractTests(contractId, config)
            .then(result => ({ contractId, result }))
            .catch(error => ({ contractId, error }))
        );

        const batchResults = await Promise.all(batchPromises);
        
        for (const item of batchResults) {
          if ('result' in item) {
            results.set(item.contractId, item.result);
          } else {
            logger.error(`Failed to run tests for ${item.contractId}:`, item.error);
          }
        }
      }
    } else {
      // Run contracts sequentially
      for (const contractId of this.testSuites.keys()) {
        try {
          const result = await this.runContractTests(contractId, config);
          results.set(contractId, result);
        } catch (error) {
          logger.error(`Failed to run tests for ${contractId}:`, error);
        }
      }
    }

    logger.info(`Completed test runs for ${results.size} contracts`);
    return results;
  }

  /**
   * Generate comprehensive violation report
   */
  async generateViolationReport(contractId: string): Promise<ViolationReport> {
    try {
      const testResult = await this.getLatestTestResult(contractId);
      
      if (!testResult) {
        throw new ContractError(
          `No test results found for contract: ${contractId}`,
          contractId,
          'report-generation'
        );
      }

      const violations = testResult.violations;
      const summary = this.generateViolationSummary(violations);
      const recommendations = this.generateRecommendations(violations, testResult.metrics);

      const report: ViolationReport = {
        id: `violation-report-${contractId}-${Date.now()}`,
        contractId,
        summary,
        violations,
        metrics: testResult.metrics,
        recommendations,
        generatedAt: new Date(),
      };

      // Save report if configured
      if (this.config.saveResults && this.config.resultsPath) {
        await this.saveViolationReport(report);
      }

      return report;
    } catch (error) {
      logger.error(`Failed to generate violation report for ${contractId}:`, error);
      throw new ContractError(
        `Violation report generation failed: ${error instanceof Error ? error.message : String(error)}`,
        contractId,
        'report-generation',
        { originalError: error }
      );
    }
  }

  /**
   * Run property tests in parallel
   */
  private async runPropertiesParallel(
    testSuite: ContractTestSuite,
    config: Required<TestRunConfig>
  ): Promise<Map<string, PropertyTestResult>> {
    const results = new Map<string, PropertyTestResult>();
    const concurrency = config.maxConcurrency;
    const properties = testSuite.properties;

    logger.debug(`Running ${properties.length} properties in parallel (concurrency: ${concurrency})`);

    // Split properties into batches
    for (let i = 0; i < properties.length; i += concurrency) {
      const batch = properties.slice(i, i + concurrency);
      const batchPromises = batch.map(property => 
        this.runSingleProperty(property, testSuite.config, config.timeout!)
          .then(result => ({ property: property.name, result }))
          .catch(error => ({ 
            property: property.name, 
            result: {
              success: false,
              numTests: 0,
              numShrinks: 0,
              seed: 0,
              error: error instanceof Error ? error.message : String(error),
            } as PropertyTestResult
          }))
      );

      const batchResults = await Promise.all(batchPromises);
      
      for (const item of batchResults) {
        results.set(item.property, item.result);
      }
    }

    return results;
  }

  /**
   * Run property tests sequentially
   */
  private async runPropertiesSequential(
    testSuite: ContractTestSuite,
    config: Required<TestRunConfig>
  ): Promise<Map<string, PropertyTestResult>> {
    const results = new Map<string, PropertyTestResult>();

    logger.debug(`Running ${testSuite.properties.length} properties sequentially`);

    for (const property of testSuite.properties) {
      try {
        const result = await this.runSingleProperty(property, testSuite.config, config.timeout!);
        results.set(property.name, result);
      } catch (error) {
        results.set(property.name, {
          success: false,
          numTests: 0,
          numShrinks: 0,
          seed: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Run a single property test
   */
  private async runSingleProperty(
    property: GeneratedProperty,
    config: PropertyTestConfig,
    timeout: number
  ): Promise<PropertyTestResult> {
    try {
      logger.debug(`Running property test: ${property.name}`);

      // Create property test with timeout
      const test = fc.property(property.arbitrary, property.predicate);
      
      const fcConfig = {
        numRuns: config.numRuns || 100,
        timeout: Math.min(timeout, config.timeout || 5000),
        seed: config.seed,
        maxShrinks: config.maxShrinks || 1000,
        skipAllAfterTimeLimit: config.skipAllAfterTimeLimit || 10000,
        interruptAfterTimeLimit: config.interruptAfterTimeLimit || 15000,
        markInterruptAsFailure: config.markInterruptAsFailure || false,
      };

      const result = await fc.check(test, fcConfig);

      return {
        success: result.failed === false,
        numTests: result.numRuns,
        numShrinks: result.numShrinks,
        seed: result.seed,
        counterExample: result.counterexample,
        shrunkCounterExample: result.counterexamplePath ? result.counterexamplePath[result.counterexamplePath.length - 1] : undefined,
        error: result.failed ? `Property failed with counterexample` : undefined,
      };

    } catch (error) {
      logger.error(`Property test failed for ${property.name}:`, error);
      return {
        success: false,
        numTests: 0,
        numShrinks: 0,
        seed: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Analyze test results and generate metrics
   */
  private async analyzeTestResults(
    contractId: string,
    propertyResults: Map<string, PropertyTestResult>,
    duration: number
  ): Promise<TestRunResult> {
    const violations: ContractViolation[] = [];
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    // Process property results
    for (const [propertyName, result] of propertyResults.entries()) {
      totalTests += result.numTests;
      
      if (result.success) {
        passedTests += result.numTests;
      } else {
        failedTests += result.numTests;
        
        // Convert failed property to violation
        const violation: ContractViolation = {
          id: `property-violation-${contractId}-${propertyName}-${Date.now()}`,
          contractId,
          violationType: 'invariant', // Property tests are treated as invariant violations
          conditionName: propertyName,
          severity: 'error',
          message: result.error || 'Property test failed',
          input: result.counterExample,
          expected: 'Property should hold for all inputs',
          actual: 'Property violated',
          context: {
            numTests: result.numTests,
            numShrinks: result.numShrinks,
            seed: result.seed,
            shrunkCounterExample: result.shrunkCounterExample,
          },
          timestamp: new Date(),
        };
        
        violations.push(violation);
      }
    }

    const metrics: ContractMetrics = {
      totalTests,
      passedTests,
      failedTests,
      coverage: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      preConditionChecks: 0, // These would be tracked separately
      postConditionChecks: 0,
      metamorphicLawChecks: 0,
      invariantChecks: propertyResults.size,
    };

    return {
      contractId,
      success: failedTests === 0,
      totalTests,
      passedTests,
      failedTests,
      duration,
      propertyResults,
      violations,
      metrics,
    };
  }

  /**
   * Generate violation summary statistics
   */
  private generateViolationSummary(violations: ContractViolation[]): ViolationSummary {
    const errorCount = violations.filter(v => v.severity === 'error').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;
    const infoCount = violations.filter(v => v.severity === 'info').length;

    const violationTypes = new Map<string, number>();
    for (const violation of violations) {
      const count = violationTypes.get(violation.violationType) || 0;
      violationTypes.set(violation.violationType, count + 1);
    }

    const topViolationTypes = Array.from(violationTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const affectedContracts = new Set(violations.map(v => v.contractId)).size;

    return {
      totalViolations: violations.length,
      errorCount,
      warningCount,
      infoCount,
      affectedContracts,
      topViolationTypes,
    };
  }

  /**
   * Generate recommendations based on violations and metrics
   */
  private generateRecommendations(violations: ContractViolation[], metrics: ContractMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.coverage < 80) {
      recommendations.push(
        `Low test coverage (${metrics.coverage.toFixed(1)}%). Consider adding more comprehensive property tests.`
      );
    }

    const errorViolations = violations.filter(v => v.severity === 'error');
    if (errorViolations.length > 0) {
      recommendations.push(
        `Found ${errorViolations.length} critical contract violations. These should be addressed immediately.`
      );
    }

    const preConditionViolations = violations.filter(v => v.violationType === 'pre-condition');
    if (preConditionViolations.length > 0) {
      recommendations.push(
        'Pre-condition violations detected. Review input validation and add stronger guards.'
      );
    }

    const metamorphicViolations = violations.filter(v => v.violationType === 'metamorphic-law');
    if (metamorphicViolations.length > 0) {
      recommendations.push(
        'Metamorphic law violations suggest algorithmic issues. Review the core logic implementation.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('All contract tests passed successfully. Consider adding more edge case tests.');
    }

    return recommendations;
  }

  /**
   * Save test report to file system
   */
  private async saveTestReport(
    contractId: string,
    result: TestRunResult,
    config: TestRunConfig
  ): Promise<void> {
    try {
      await this.ensureResultsDirectory();

      const report: TestReport = {
        id: `test-report-${contractId}-${Date.now()}`,
        contractId,
        timestamp: new Date(),
        result,
        config,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          cpuCount: cpus().length,
          memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        },
      };

      const reportPath = join(this.config.resultsPath!, `${contractId}-report.json`);
      await writeFile(reportPath, JSON.stringify(report, null, 2));

      logger.debug(`Saved test report for ${contractId} to ${reportPath}`);
    } catch (error) {
      logger.error(`Failed to save test report for ${contractId}:`, error);
      // Don't throw - report saving is not critical
    }
  }

  /**
   * Save violation report to file system
   */
  private async saveViolationReport(report: ViolationReport): Promise<void> {
    try {
      await this.ensureResultsDirectory();
      const reportPath = join(this.config.resultsPath!, `${report.contractId}-violations.json`);
      await writeFile(reportPath, JSON.stringify(report, null, 2));
      logger.debug(`Saved violation report to ${reportPath}`);
    } catch (error) {
      logger.error(`Failed to save violation report:`, error);
    }
  }

  /**
   * Get latest test result for a contract
   */
  private async getLatestTestResult(contractId: string): Promise<TestRunResult | null> {
    try {
      if (!this.config.resultsPath || !existsSync(this.config.resultsPath)) {
        return null;
      }

      const reportPath = join(this.config.resultsPath, `${contractId}-report.json`);
      if (!existsSync(reportPath)) {
        return null;
      }

      const reportData = await readFile(reportPath, 'utf-8');
      const report: TestReport = JSON.parse(reportData);
      return report.result;
    } catch (error) {
      logger.error(`Failed to load latest test result for ${contractId}:`, error);
      return null;
    }
  }

  /**
   * Ensure results directory exists
   */
  private async ensureResultsDirectory(): Promise<void> {
    if (this.config.resultsPath && !existsSync(this.config.resultsPath)) {
      await mkdir(this.config.resultsPath, { recursive: true });
    }
  }

  /**
   * Clear all test results and suites
   */
  clearAll(): void {
    this.testSuites.clear();
    this.runningTests.clear();
  }

  /**
   * Get currently running tests
   */
  getRunningTests(): string[] {
    return Array.from(this.runningTests);
  }

  /**
   * Get loaded test suites
   */
  getLoadedTestSuites(): string[] {
    return Array.from(this.testSuites.keys());
  }
}