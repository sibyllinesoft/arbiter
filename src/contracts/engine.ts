/**
 * Main contract execution engine that parses CUE definitions and orchestrates validation
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { 
  ContractDefinition, 
  ContractExecutionResult, 
  ContractExecutionContext,
  ContractValidationOptions,
  ContractViolation,
  ContractMetrics,
  ContractDefinitionSchema,
  ContractError,
  ContractParsingError,
  ContractExecutionError,
  CueValue
} from './types.js';
import { ContractValidator } from './validator.js';
import { PropertyGenerator } from './property-generator.js';
import { ContractTestRunner } from './runner.js';

const execAsync = promisify(exec);

export class ContractEngine {
  private readonly validator: ContractValidator;
  private readonly propertyGenerator: PropertyGenerator;
  private readonly testRunner: ContractTestRunner;
  private readonly contractCache = new Map<string, ContractDefinition>();
  
  constructor(
    private readonly cueExecutablePath: string = 'cue',
    private readonly contractsPath: string = './contracts'
  ) {
    this.validator = new ContractValidator();
    this.propertyGenerator = new PropertyGenerator();
    this.testRunner = new ContractTestRunner();
  }

  /**
   * Parse contract definitions from CUE files
   */
  async parseContractFromCue(cueFilePath: string): Promise<ContractDefinition> {
    try {
      logger.info(`Parsing contract from CUE file: ${cueFilePath}`);
      
      if (!existsSync(cueFilePath)) {
        throw new ContractParsingError(
          `CUE file not found: ${cueFilePath}`,
          'unknown'
        );
      }

      // Execute CUE command to export JSON
      const { stdout, stderr } = await execAsync(
        `${this.cueExecutablePath} export --out json ${cueFilePath}`
      );

      if (stderr && stderr.trim()) {
        logger.warn(`CUE parsing warnings: ${stderr}`);
      }

      const cueData: CueValue = JSON.parse(stdout);
      
      // Transform CUE data to ContractDefinition
      const contract = this.transformCueToContract(cueData);
      
      // Validate the contract definition
      const validationResult = ContractDefinitionSchema.safeParse(contract);
      if (!validationResult.success) {
        throw new ContractParsingError(
          `Invalid contract definition: ${validationResult.error.message}`,
          contract.id || 'unknown',
          { zodError: validationResult.error }
        );
      }

      // Cache the contract
      this.contractCache.set(contract.id, contract);
      
      logger.info(`Successfully parsed contract: ${contract.id}`);
      return contract;

    } catch (error) {
      logger.error(`Failed to parse contract from CUE: ${error}`);
      
      if (error instanceof ContractParsingError) {
        throw error;
      }
      
      throw new ContractParsingError(
        `CUE parsing failed: ${error instanceof Error ? error.message : String(error)}`,
        'unknown',
        { originalError: error }
      );
    }
  }

  /**
   * Load all contract definitions from the contracts directory
   */
  async loadAllContracts(): Promise<ContractDefinition[]> {
    try {
      logger.info(`Loading contracts from directory: ${this.contractsPath}`);
      
      if (!existsSync(this.contractsPath)) {
        logger.warn(`Contracts directory not found: ${this.contractsPath}`);
        return [];
      }

      const { stdout } = await execAsync(
        `find ${this.contractsPath} -name "*.cue" -type f`
      );

      const cueFiles = stdout
        .split('\n')
        .filter(file => file.trim() && file.endsWith('.cue'));

      const contracts: ContractDefinition[] = [];
      
      for (const cueFile of cueFiles) {
        try {
          const contract = await this.parseContractFromCue(cueFile);
          contracts.push(contract);
        } catch (error) {
          logger.error(`Failed to load contract from ${cueFile}: ${error}`);
          // Continue loading other contracts
        }
      }

      logger.info(`Loaded ${contracts.length} contracts from ${cueFiles.length} files`);
      return contracts;

    } catch (error) {
      logger.error(`Failed to load contracts: ${error}`);
      throw new ContractError(
        `Contract loading failed: ${error instanceof Error ? error.message : String(error)}`,
        'bulk-load',
        'loading',
        { contractsPath: this.contractsPath }
      );
    }
  }

  /**
   * Execute contract validation for a specific function call
   */
  async executeContract(
    contractId: string,
    context: ContractExecutionContext,
    options: ContractValidationOptions = {}
  ): Promise<ContractExecutionResult> {
    const startTime = Date.now();
    
    try {
      logger.debug(`Executing contract: ${contractId}`);

      const contract = await this.getContract(contractId);
      const violations: ContractViolation[] = [];
      
      const defaultOptions: Required<ContractValidationOptions> = {
        validatePreConditions: true,
        validatePostConditions: true,
        validateMetamorphicLaws: true,
        validateInvariants: true,
        generateTests: false,
        runTests: false,
        parallel: true,
        maxConcurrency: 10,
        timeout: 30000,
        continueOnError: true,
        ...options
      };

      // Validate pre-conditions
      if (defaultOptions.validatePreConditions && context.input !== undefined) {
        const preViolations = await this.validator.validatePreConditions(
          contract,
          context.input,
          context
        );
        violations.push(...preViolations);
      }

      // Validate post-conditions
      if (defaultOptions.validatePostConditions && context.output !== undefined) {
        const postViolations = await this.validator.validatePostConditions(
          contract,
          context.input,
          context.output,
          context
        );
        violations.push(...postViolations);
      }

      // Validate metamorphic laws
      if (defaultOptions.validateMetamorphicLaws && context.output !== undefined) {
        const metamorphicViolations = await this.validator.validateMetamorphicLaws(
          contract,
          context.input,
          context.output,
          context
        );
        violations.push(...metamorphicViolations);
      }

      // Validate invariants
      if (defaultOptions.validateInvariants) {
        const invariantViolations = await this.validator.validateInvariants(
          contract,
          context
        );
        violations.push(...invariantViolations);
      }

      // Generate and run property tests if requested
      if (defaultOptions.generateTests || defaultOptions.runTests) {
        await this.runPropertyTests(contract, context, defaultOptions);
      }

      const duration = Date.now() - startTime;
      const success = violations.length === 0;

      const metrics: ContractMetrics = {
        totalTests: 1,
        passedTests: success ? 1 : 0,
        failedTests: success ? 0 : 1,
        coverage: this.calculateCoverage(contract, violations),
        preConditionChecks: contract.preConditions.length,
        postConditionChecks: contract.postConditions.length,
        metamorphicLawChecks: contract.metamorphicLaws.length,
        invariantChecks: contract.invariants.length,
      };

      const result: ContractExecutionResult = {
        contractId,
        success,
        violations,
        metrics,
        duration,
        timestamp: new Date(),
      };

      if (violations.length > 0) {
        logger.warn(`Contract violations detected for ${contractId}:`, {
          violationCount: violations.length,
          violations: violations.map(v => ({
            type: v.violationType,
            condition: v.conditionName,
            severity: v.severity,
            message: v.message
          }))
        });
      } else {
        logger.debug(`Contract ${contractId} executed successfully`);
      }

      return result;

    } catch (error) {
      logger.error(`Contract execution failed for ${contractId}: ${error}`);
      
      const duration = Date.now() - startTime;
      
      return {
        contractId,
        success: false,
        violations: [{
          id: `${contractId}-execution-error-${Date.now()}`,
          contractId,
          violationType: 'invariant',
          conditionName: 'execution',
          severity: 'error',
          message: `Contract execution failed: ${error instanceof Error ? error.message : String(error)}`,
          context: { ...context.metadata, error: String(error) },
          timestamp: new Date(),
          stackTrace: error instanceof Error ? error.stack : undefined,
        }],
        metrics: {
          totalTests: 1,
          passedTests: 0,
          failedTests: 1,
          coverage: 0,
          preConditionChecks: 0,
          postConditionChecks: 0,
          metamorphicLawChecks: 0,
          invariantChecks: 0,
        },
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Generate property-based tests for a contract
   */
  async generatePropertyTests(contractId: string): Promise<void> {
    try {
      const contract = await this.getContract(contractId);
      const testSuite = await this.propertyGenerator.generateTestSuite(contract);
      
      logger.info(`Generated ${testSuite.properties.length} property tests for ${contractId}`);
      
      // Save the test suite for later execution
      await this.testRunner.saveTestSuite(testSuite);
      
    } catch (error) {
      logger.error(`Failed to generate property tests for ${contractId}: ${error}`);
      throw new ContractExecutionError(
        `Property test generation failed: ${error instanceof Error ? error.message : String(error)}`,
        contractId,
        { originalError: error }
      );
    }
  }

  /**
   * Run property-based tests for a contract
   */
  async runPropertyTests(
    contract: ContractDefinition,
    context: ContractExecutionContext,
    options: Required<ContractValidationOptions>
  ): Promise<void> {
    try {
      if (options.generateTests) {
        const testSuite = await this.propertyGenerator.generateTestSuite(contract);
        await this.testRunner.saveTestSuite(testSuite);
      }

      if (options.runTests) {
        await this.testRunner.runContractTests(contract.id, {
          parallel: options.parallel,
          maxConcurrency: options.maxConcurrency,
          timeout: options.timeout,
        });
      }
    } catch (error) {
      logger.error(`Property test execution failed: ${error}`);
      throw error;
    }
  }

  /**
   * Transform CUE data structure to ContractDefinition
   */
  private transformCueToContract(cueData: CueValue): ContractDefinition {
    // This is a simplified transformation - you may need to adjust based on your CUE schema
    const contract: ContractDefinition = {
      id: cueData.id || `contract-${Date.now()}`,
      name: cueData.name || 'Unnamed Contract',
      description: cueData.description || '',
      version: cueData.version || '1.0.0',
      target: cueData.target || '',
      inputSchema: cueData.inputSchema || { type: 'object' },
      outputSchema: cueData.outputSchema || { type: 'object' },
      preConditions: (cueData.preConditions || []).map((pc: any) => ({
        name: pc.name,
        description: pc.description || '',
        expression: pc.expression,
        severity: pc.severity || 'error',
        schema: pc.schema,
        metadata: pc.metadata || {},
      })),
      postConditions: (cueData.postConditions || []).map((pc: any) => ({
        name: pc.name,
        description: pc.description || '',
        expression: pc.expression,
        severity: pc.severity || 'error',
        schema: pc.schema,
        metadata: pc.metadata || {},
      })),
      metamorphicLaws: (cueData.metamorphicLaws || []).map((ml: any) => ({
        name: ml.name,
        description: ml.description || '',
        sourceExpression: ml.sourceExpression,
        targetExpression: ml.targetExpression,
        transformation: ml.transformation,
        invariants: ml.invariants || [],
        examples: ml.examples || [],
      })),
      invariants: (cueData.invariants || []).map((inv: any) => ({
        name: inv.name,
        description: inv.description || '',
        expression: inv.expression,
        scope: inv.scope || 'local',
        checkFrequency: inv.checkFrequency || 'always',
      })),
      metadata: cueData.metadata || {},
      tags: cueData.tags || [],
    };

    return contract;
  }

  /**
   * Get contract from cache or load from file
   */
  private async getContract(contractId: string): Promise<ContractDefinition> {
    if (this.contractCache.has(contractId)) {
      return this.contractCache.get(contractId)!;
    }

    // Try to load from file
    const contractFile = join(this.contractsPath, `${contractId}.cue`);
    if (existsSync(contractFile)) {
      return await this.parseContractFromCue(contractFile);
    }

    throw new ContractError(
      `Contract not found: ${contractId}`,
      contractId,
      'not-found'
    );
  }

  /**
   * Calculate coverage percentage based on violations
   */
  private calculateCoverage(contract: ContractDefinition, violations: ContractViolation[]): number {
    const totalConditions = 
      contract.preConditions.length + 
      contract.postConditions.length + 
      contract.metamorphicLaws.length + 
      contract.invariants.length;

    if (totalConditions === 0) return 100;

    const violatedConditions = new Set(violations.map(v => v.conditionName));
    const coveredConditions = totalConditions - violatedConditions.size;
    
    return Math.round((coveredConditions / totalConditions) * 100);
  }

  /**
   * Clear contract cache
   */
  clearCache(): void {
    this.contractCache.clear();
  }

  /**
   * Get cached contract definitions
   */
  getCachedContracts(): ContractDefinition[] {
    return Array.from(this.contractCache.values());
  }
}