/**
 * Contract validation gate
 * Validates contracts using the contract execution engine and ensures compliance
 */

import { join } from 'path';
import { readFile, access } from 'fs/promises';
import {
  GateExecutor,
  GateConfiguration,
  GateExecutionContext,
  GateResult,
  GateStatus,
  GateFinding,
  ValidationResult
} from './types.js';
import { ContractExecution } from '../contract-execution.js';
import { ContractParser } from '../contract-parser.js';
import { 
  ContractDefinition, 
  ContractExecutionResult,
  MetamorphicLawResult,
  PropertyTestResult
} from '../types.js';

export interface ContractGateSettings {
  /** Validate contract properties */
  validateProperties: boolean;
  /** Check contract invariants */
  checkInvariants: boolean;
  /** Run metamorphic property tests */
  runMetamorphicTests: boolean;
  /** Maximum test cases per property */
  maxTestCases: number;
  /** Test timeout in milliseconds */
  testTimeout: number;
  /** Contract file patterns to validate */
  contractPatterns: string[];
  /** Exclude patterns for contracts */
  excludePatterns: string[];
  /** Only validate contracts for changed files */
  differentialOnly: boolean;
  /** Fail gate if no contracts found */
  failOnNoContracts: boolean;
  /** Enable property-based testing */
  enablePropertyTesting: boolean;
  /** Enable formal verification */
  enableFormalVerification: boolean;
  /** Contract violation tolerance */
  violationTolerance: {
    /** Maximum allowed property violations */
    maxPropertyViolations: number;
    /** Maximum allowed invariant violations */
    maxInvariantViolations: number;
    /** Maximum allowed metamorphic law violations */
    maxMetamorphicViolations: number;
  };
}

export interface ContractValidationResult {
  /** Contract being validated */
  contract: ContractDefinition;
  /** File path */
  filePath: string;
  /** Contract execution result */
  executionResult: ContractExecutionResult;
  /** Property test results */
  propertyResults: PropertyTestResult[];
  /** Metamorphic law results */
  metamorphicResults: MetamorphicLawResult[];
  /** Validation status */
  status: 'passed' | 'failed' | 'error';
  /** Error message if failed */
  error?: string;
  /** Execution time */
  executionTime: number;
}

export interface ContractSummary {
  /** Total contracts validated */
  totalContracts: number;
  /** Contracts that passed validation */
  passedContracts: number;
  /** Contracts that failed validation */
  failedContracts: number;
  /** Contracts with errors */
  errorContracts: number;
  /** Total properties tested */
  totalProperties: number;
  /** Properties that passed */
  passedProperties: number;
  /** Properties that failed */
  failedProperties: number;
  /** Total metamorphic laws tested */
  totalMetamorphicLaws: number;
  /** Metamorphic laws that passed */
  passedMetamorphicLaws: number;
  /** Metamorphic laws that failed */
  failedMetamorphicLaws: number;
}

/**
 * Contract validation gate implementation
 */
export class ContractGate implements GateExecutor {
  private contractExecution: ContractExecution;
  private contractParser: ContractParser;

  constructor() {
    this.contractExecution = new ContractExecution();
    this.contractParser = new ContractParser();
  }

  /**
   * Execute the contract gate
   */
  async executeGate(
    gate: GateConfiguration,
    context: GateExecutionContext
  ): Promise<GateResult> {
    const startTime = new Date();
    const settings = this.validateAndParseSettings(gate.settings);

    try {
      // Find contract files to validate
      const contractFiles = await this.findContractFiles(settings, context);

      if (contractFiles.length === 0) {
        if (settings.failOnNoContracts) {
          throw new Error('No contracts found for validation');
        } else {
          return this.createSkippedResult(gate, startTime, 'No contracts found');
        }
      }

      // Validate contracts
      const validationResults = await this.validateContracts(
        contractFiles,
        settings,
        context
      );

      // Analyze results
      const analysis = this.analyzeResults(validationResults, settings);

      // Generate findings
      const findings = this.generateFindings(analysis, settings);

      // Determine gate status
      const status = this.determineGateStatus(findings, analysis);

      const endTime = new Date();

      return {
        gateId: gate.id,
        name: gate.name,
        status,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        details: {
          summary: this.generateSummary(analysis, status),
          findings,
          recommendations: this.generateRecommendations(analysis, settings),
          reportUrls: this.generateReportUrls(context)
        },
        metrics: this.extractMetrics(analysis)
      };

    } catch (error) {
      const endTime = new Date();
      return this.createErrorResult(gate, error as Error, startTime, endTime);
    }
  }

  /**
   * Validate gate configuration
   */
  validateConfiguration(config: GateConfiguration): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const settings = config.settings as ContractGateSettings;

      // Validate required settings
      if (typeof settings.validateProperties !== 'boolean') {
        errors.push('validateProperties must be a boolean');
      }

      if (typeof settings.checkInvariants !== 'boolean') {
        errors.push('checkInvariants must be a boolean');
      }

      if (typeof settings.runMetamorphicTests !== 'boolean') {
        errors.push('runMetamorphicTests must be a boolean');
      }

      // Validate numeric settings
      if (typeof settings.maxTestCases !== 'number' || settings.maxTestCases < 1) {
        errors.push('maxTestCases must be a positive number');
      }

      if (typeof settings.testTimeout !== 'number' || settings.testTimeout < 1000) {
        errors.push('testTimeout must be at least 1000ms');
      }

      // Validate patterns
      if (!Array.isArray(settings.contractPatterns)) {
        errors.push('contractPatterns must be an array of glob patterns');
      }

      if (!Array.isArray(settings.excludePatterns)) {
        warnings.push('excludePatterns should be an array of glob patterns');
      }

      // Validate violation tolerance
      if (settings.violationTolerance) {
        const tolerance = settings.violationTolerance;
        if (typeof tolerance.maxPropertyViolations !== 'number' || tolerance.maxPropertyViolations < 0) {
          errors.push('maxPropertyViolations must be a non-negative number');
        }
        if (typeof tolerance.maxInvariantViolations !== 'number' || tolerance.maxInvariantViolations < 0) {
          errors.push('maxInvariantViolations must be a non-negative number');
        }
        if (typeof tolerance.maxMetamorphicViolations !== 'number' || tolerance.maxMetamorphicViolations < 0) {
          errors.push('maxMetamorphicViolations must be a non-negative number');
        }
      }

    } catch (error) {
      errors.push(`Invalid settings object: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if gate should be skipped
   */
  shouldSkip(gate: GateConfiguration, context: GateExecutionContext): boolean {
    const settings = gate.settings as ContractGateSettings;

    // Skip if no contract-related files changed and differential mode is enabled
    if (settings.differentialOnly) {
      const hasContractChanges = context.changedFiles.some(file =>
        file.includes('contract') ||
        file.endsWith('.contract.ts') ||
        file.endsWith('.spec.ts') ||
        settings.contractPatterns.some(pattern => 
          new RegExp(pattern.replace(/\*/g, '.*')).test(file)
        )
      );

      if (!hasContractChanges) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find contract files to validate
   */
  private async findContractFiles(
    settings: ContractGateSettings,
    context: GateExecutionContext
  ): Promise<string[]> {
    const contractFiles: string[] = [];

    if (settings.differentialOnly) {
      // Only check changed files
      for (const file of context.changedFiles) {
        if (this.matchesContractPattern(file, settings)) {
          contractFiles.push(join(context.workingDirectory, file));
        }
      }
    } else {
      // Find all contract files in the repository
      const { glob } = await import('glob');
      
      for (const pattern of settings.contractPatterns) {
        const files = await glob(pattern, {
          cwd: context.workingDirectory,
          ignore: settings.excludePatterns
        });
        
        contractFiles.push(...files.map(f => join(context.workingDirectory, f)));
      }
    }

    return [...new Set(contractFiles)]; // Remove duplicates
  }

  /**
   * Check if file matches contract patterns
   */
  private matchesContractPattern(file: string, settings: ContractGateSettings): boolean {
    // Check if file matches any contract pattern
    const matchesInclude = settings.contractPatterns.some(pattern =>
      new RegExp(pattern.replace(/\*/g, '.*')).test(file)
    );

    // Check if file matches any exclude pattern
    const matchesExclude = settings.excludePatterns.some(pattern =>
      new RegExp(pattern.replace(/\*/g, '.*')).test(file)
    );

    return matchesInclude && !matchesExclude;
  }

  /**
   * Validate contracts
   */
  private async validateContracts(
    contractFiles: string[],
    settings: ContractGateSettings,
    context: GateExecutionContext
  ): Promise<ContractValidationResult[]> {
    const results: ContractValidationResult[] = [];

    for (const filePath of contractFiles) {
      try {
        const validationResult = await this.validateSingleContract(
          filePath,
          settings,
          context
        );
        results.push(validationResult);
      } catch (error) {
        // Create error result for this contract
        results.push({
          contract: {} as ContractDefinition, // Empty contract for error case
          filePath,
          executionResult: {} as ContractExecutionResult,
          propertyResults: [],
          metamorphicResults: [],
          status: 'error',
          error: (error as Error).message,
          executionTime: 0
        });
      }
    }

    return results;
  }

  /**
   * Validate a single contract
   */
  private async validateSingleContract(
    filePath: string,
    settings: ContractGateSettings,
    context: GateExecutionContext
  ): Promise<ContractValidationResult> {
    const startTime = Date.now();

    try {
      // Check if file exists
      await access(filePath);

      // Read contract file
      const contractContent = await readFile(filePath, 'utf-8');

      // Parse contract
      const contract = await this.contractParser.parseContract(contractContent, filePath);

      // Execute contract validation
      const executionResult = await this.contractExecution.executeContract(contract);

      // Run property tests if enabled
      const propertyResults: PropertyTestResult[] = [];
      if (settings.validateProperties && settings.enablePropertyTesting) {
        for (const property of contract.properties) {
          const result = await this.contractExecution.executePropertyTest(
            property,
            {
              maxTestCases: settings.maxTestCases,
              timeout: settings.testTimeout
            }
          );
          propertyResults.push(result);
        }
      }

      // Run metamorphic tests if enabled
      const metamorphicResults: MetamorphicLawResult[] = [];
      if (settings.runMetamorphicTests && contract.metamorphicLaws) {
        for (const law of contract.metamorphicLaws) {
          const result = await this.contractExecution.executeMetamorphicTest(
            law,
            {
              maxTestCases: settings.maxTestCases,
              timeout: settings.testTimeout
            }
          );
          metamorphicResults.push(result);
        }
      }

      // Determine validation status
      const status = this.determineValidationStatus(
        executionResult,
        propertyResults,
        metamorphicResults,
        settings
      );

      const executionTime = Date.now() - startTime;

      return {
        contract,
        filePath,
        executionResult,
        propertyResults,
        metamorphicResults,
        status,
        executionTime
      };

    } catch (error) {
      return {
        contract: {} as ContractDefinition,
        filePath,
        executionResult: {} as ContractExecutionResult,
        propertyResults: [],
        metamorphicResults: [],
        status: 'error',
        error: (error as Error).message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Determine validation status for a single contract
   */
  private determineValidationStatus(
    executionResult: ContractExecutionResult,
    propertyResults: PropertyTestResult[],
    metamorphicResults: MetamorphicLawResult[],
    settings: ContractGateSettings
  ): 'passed' | 'failed' | 'error' {
    const tolerance = settings.violationTolerance;

    // Check property violations
    const propertyViolations = propertyResults.filter(r => !r.passed).length;
    if (propertyViolations > tolerance.maxPropertyViolations) {
      return 'failed';
    }

    // Check invariant violations
    const invariantViolations = executionResult.invariantResults?.filter(r => !r.passed).length || 0;
    if (invariantViolations > tolerance.maxInvariantViolations) {
      return 'failed';
    }

    // Check metamorphic law violations
    const metamorphicViolations = metamorphicResults.filter(r => !r.passed).length;
    if (metamorphicViolations > tolerance.maxMetamorphicViolations) {
      return 'failed';
    }

    // Check execution errors
    if (executionResult.status === 'error') {
      return 'error';
    }

    return 'passed';
  }

  /**
   * Analyze validation results
   */
  private analyzeResults(
    results: ContractValidationResult[],
    settings: ContractGateSettings
  ): ContractValidationAnalysis {
    const summary: ContractSummary = {
      totalContracts: results.length,
      passedContracts: results.filter(r => r.status === 'passed').length,
      failedContracts: results.filter(r => r.status === 'failed').length,
      errorContracts: results.filter(r => r.status === 'error').length,
      totalProperties: results.reduce((sum, r) => sum + r.propertyResults.length, 0),
      passedProperties: results.reduce((sum, r) => 
        sum + r.propertyResults.filter(p => p.passed).length, 0),
      failedProperties: results.reduce((sum, r) => 
        sum + r.propertyResults.filter(p => !p.passed).length, 0),
      totalMetamorphicLaws: results.reduce((sum, r) => sum + r.metamorphicResults.length, 0),
      passedMetamorphicLaws: results.reduce((sum, r) => 
        sum + r.metamorphicResults.filter(m => m.passed).length, 0),
      failedMetamorphicLaws: results.reduce((sum, r) => 
        sum + r.metamorphicResults.filter(m => !m.passed).length, 0)
    };

    // Calculate success rates
    const contractSuccessRate = summary.totalContracts > 0 
      ? (summary.passedContracts / summary.totalContracts) * 100 
      : 0;

    const propertySuccessRate = summary.totalProperties > 0 
      ? (summary.passedProperties / summary.totalProperties) * 100 
      : 0;

    const metamorphicSuccessRate = summary.totalMetamorphicLaws > 0 
      ? (summary.passedMetamorphicLaws / summary.totalMetamorphicLaws) * 100 
      : 0;

    return {
      results,
      summary,
      contractSuccessRate,
      propertySuccessRate,
      metamorphicSuccessRate
    };
  }

  /**
   * Generate findings from analysis
   */
  private generateFindings(
    analysis: ContractValidationAnalysis,
    settings: ContractGateSettings
  ): GateFinding[] {
    const findings: GateFinding[] = [];

    // Add findings for failed contracts
    for (const result of analysis.results) {
      if (result.status === 'failed') {
        findings.push({
          severity: 'error',
          category: 'contract-validation',
          message: `Contract validation failed: ${result.error || 'Contract requirements not met'}`,
          file: result.filePath,
          rule: 'contract-compliance'
        });

        // Add specific property failures
        for (const propResult of result.propertyResults) {
          if (!propResult.passed) {
            findings.push({
              severity: 'error',
              category: 'property-test',
              message: `Property test failed: ${propResult.property.description}`,
              file: result.filePath,
              line: propResult.property.location?.line,
              rule: 'property-validation'
            });
          }
        }

        // Add specific metamorphic law failures
        for (const metaResult of result.metamorphicResults) {
          if (!metaResult.passed) {
            findings.push({
              severity: 'error',
              category: 'metamorphic-test',
              message: `Metamorphic law violated: ${metaResult.law.name}`,
              file: result.filePath,
              rule: 'metamorphic-law-validation'
            });
          }
        }
      } else if (result.status === 'error') {
        findings.push({
          severity: 'error',
          category: 'contract-execution',
          message: `Contract execution error: ${result.error}`,
          file: result.filePath,
          rule: 'contract-execution'
        });
      }
    }

    // Add informational findings
    if (analysis.contractSuccessRate === 100) {
      findings.push({
        severity: 'info',
        category: 'contract-validation',
        message: `All ${analysis.summary.totalContracts} contracts passed validation`,
        rule: 'contract-success'
      });
    }

    if (analysis.propertySuccessRate >= 95) {
      findings.push({
        severity: 'info',
        category: 'property-test',
        message: `Excellent property test success rate: ${analysis.propertySuccessRate.toFixed(1)}%`,
        rule: 'property-excellence'
      });
    }

    return findings;
  }

  /**
   * Determine gate status
   */
  private determineGateStatus(
    findings: GateFinding[],
    analysis: ContractValidationAnalysis
  ): GateStatus {
    const errors = findings.filter(f => f.severity === 'error');
    
    if (errors.length === 0) {
      return GateStatus.PASSED;
    }
    
    // Check if any errors are contract execution errors (not validation failures)
    const executionErrors = errors.filter(f => f.category === 'contract-execution');
    if (executionErrors.length > 0) {
      return GateStatus.ERROR;
    }
    
    return GateStatus.FAILED;
  }

  /**
   * Generate summary message
   */
  private generateSummary(
    analysis: ContractValidationAnalysis,
    status: GateStatus
  ): string {
    const { summary } = analysis;

    if (status === GateStatus.PASSED) {
      return `Contract validation passed. ${summary.passedContracts}/${summary.totalContracts} contracts validated successfully. Properties: ${summary.passedProperties}/${summary.totalProperties} passed.`;
    } else if (status === GateStatus.ERROR) {
      return `Contract validation encountered errors. ${summary.errorContracts} contract(s) had execution errors.`;
    } else {
      return `Contract validation failed. ${summary.failedContracts}/${summary.totalContracts} contracts failed validation. Properties: ${summary.failedProperties}/${summary.totalProperties} failed.`;
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    analysis: ContractValidationAnalysis,
    settings: ContractGateSettings
  ): string[] {
    const recommendations: string[] = [];

    if (analysis.summary.failedContracts > 0) {
      recommendations.push('Review failed contract validations and fix contract violations');
      recommendations.push('Ensure all contract preconditions and postconditions are properly implemented');
    }

    if (analysis.summary.failedProperties > 0) {
      recommendations.push('Fix failing property tests by reviewing test inputs and expected behaviors');
      recommendations.push('Consider adjusting property test parameters or adding more specific test cases');
    }

    if (analysis.summary.failedMetamorphicLaws > 0) {
      recommendations.push('Review metamorphic law violations and ensure implementation consistency');
      recommendations.push('Verify that metamorphic relationships hold for all valid inputs');
    }

    if (analysis.summary.errorContracts > 0) {
      recommendations.push('Fix contract execution errors by reviewing contract syntax and dependencies');
      recommendations.push('Ensure all required contract dependencies are available');
    }

    if (analysis.summary.totalContracts === 0) {
      recommendations.push('Consider adding contracts to improve code quality and documentation');
      recommendations.push('Define preconditions, postconditions, and invariants for critical functions');
    }

    // Performance recommendations
    if (analysis.summary.totalProperties > 100) {
      recommendations.push('Consider enabling differential contract validation for faster CI builds');
    }

    return recommendations;
  }

  /**
   * Generate report URLs
   */
  private generateReportUrls(context: GateExecutionContext): string[] {
    const urls: string[] = [];

    // Add contract report URL if available
    const reportPath = join(context.workingDirectory, '.arbiter', 'contract-report.html');
    urls.push(`file://${reportPath}`);

    return urls;
  }

  /**
   * Extract metrics for reporting
   */
  private extractMetrics(analysis: ContractValidationAnalysis): Record<string, number> {
    const { summary } = analysis;

    return {
      'contracts.total': summary.totalContracts,
      'contracts.passed': summary.passedContracts,
      'contracts.failed': summary.failedContracts,
      'contracts.error': summary.errorContracts,
      'contracts.successRate': analysis.contractSuccessRate,
      'properties.total': summary.totalProperties,
      'properties.passed': summary.passedProperties,
      'properties.failed': summary.failedProperties,
      'properties.successRate': analysis.propertySuccessRate,
      'metamorphic.total': summary.totalMetamorphicLaws,
      'metamorphic.passed': summary.passedMetamorphicLaws,
      'metamorphic.failed': summary.failedMetamorphicLaws,
      'metamorphic.successRate': analysis.metamorphicSuccessRate
    };
  }

  /**
   * Validate and parse gate settings
   */
  private validateAndParseSettings(settings: any): ContractGateSettings {
    const defaults: ContractGateSettings = {
      validateProperties: true,
      checkInvariants: true,
      runMetamorphicTests: true,
      maxTestCases: 100,
      testTimeout: 30000,
      contractPatterns: [
        '**/*.contract.ts',
        '**/*.contract.js',
        '**/*-contract.ts',
        '**/*-contract.js'
      ],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**'
      ],
      differentialOnly: false,
      failOnNoContracts: false,
      enablePropertyTesting: true,
      enableFormalVerification: false,
      violationTolerance: {
        maxPropertyViolations: 0,
        maxInvariantViolations: 0,
        maxMetamorphicViolations: 0
      }
    };

    return { ...defaults, ...settings };
  }

  /**
   * Create skipped result
   */
  private createSkippedResult(
    gate: GateConfiguration,
    startTime: Date,
    reason: string
  ): GateResult {
    const endTime = new Date();
    
    return {
      gateId: gate.id,
      name: gate.name,
      status: GateStatus.SKIPPED,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      details: {
        summary: `Contract gate skipped: ${reason}`,
        findings: [],
        recommendations: [],
        reportUrls: []
      },
      metrics: {}
    };
  }

  /**
   * Create error result
   */
  private createErrorResult(
    gate: GateConfiguration,
    error: Error,
    startTime: Date,
    endTime: Date
  ): GateResult {
    return {
      gateId: gate.id,
      name: gate.name,
      status: GateStatus.ERROR,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      details: {
        summary: `Contract gate error: ${error.message}`,
        findings: [{
          severity: 'error',
          category: 'execution',
          message: error.message,
          rule: 'gate-execution'
        }],
        recommendations: ['Check contract configuration and ensure contract files are accessible'],
        reportUrls: []
      },
      error: {
        code: 'CONTRACT_ERROR',
        message: error.message,
        details: error.stack
      },
      metrics: {}
    };
  }
}

// Supporting interfaces for internal use
interface ContractValidationAnalysis {
  results: ContractValidationResult[];
  summary: ContractSummary;
  contractSuccessRate: number;
  propertySuccessRate: number;
  metamorphicSuccessRate: number;
}