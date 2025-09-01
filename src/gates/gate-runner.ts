/**
 * Main gate execution engine
 * Executes quality gates in sequence, handles dependencies, and provides detailed reporting
 */

import { EventEmitter } from 'events';
import { createHash, randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import { 
  GateExecutionContext,
  GateConfiguration,
  GateResult,
  GateStatus,
  GateExecutionReport,
  ExecutionSummary,
  MergeRecommendation,
  GateExecutor,
  GateScheduler,
  ValidationResult
} from './types.js';
import { GateConfigurationManager, GateConfigurationSet } from './config.js';

export interface GateRunnerOptions {
  /** Maximum execution time for all gates */
  globalTimeout?: number;
  /** Maximum number of parallel gates */
  maxParallel?: number;
  /** Whether to stop on first failure */
  failFast?: boolean;
  /** Directory for storing reports */
  reportDir?: string;
  /** Custom gate executors */
  executors?: Map<string, GateExecutor>;
}

export class GateRunner extends EventEmitter implements GateScheduler {
  private configManager: GateConfigurationManager;
  private executors: Map<string, GateExecutor> = new Map();
  private activeExecutions: Map<string, Promise<GateResult>> = new Map();

  constructor(
    private options: GateRunnerOptions = {}
  ) {
    super();
    this.configManager = new GateConfigurationManager();
    
    // Register custom executors
    if (options.executors) {
      for (const [id, executor] of options.executors) {
        this.registerExecutor(id, executor);
      }
    }
  }

  /**
   * Execute all gates for the given context
   */
  async executeAll(
    context: GateExecutionContext,
    environment: string = 'default'
  ): Promise<GateExecutionReport> {
    const reportId = randomUUID();
    const startTime = performance.now();

    this.emit('execution:started', { reportId, context });

    try {
      // Load gate configurations
      const config = await this.configManager.loadConfiguration(environment);
      let gates = await this.configManager.getEnabledGates(environment);
      
      // Apply context-specific overrides
      gates = await this.configManager.applyContextOverrides(gates, context);

      // Validate gates
      this.validateGateConfiguration(gates);

      // Execute gates based on dependencies
      const results = await this.scheduleGates(gates, context);
      
      // Generate execution report
      const report = this.generateExecutionReport(
        reportId,
        context,
        results,
        config,
        startTime
      );

      this.emit('execution:completed', { report });
      return report;

    } catch (error) {
      const errorReport = this.generateErrorReport(
        reportId,
        context,
        error as Error,
        startTime
      );
      
      this.emit('execution:failed', { report: errorReport, error });
      return errorReport;
    }
  }

  /**
   * Schedule and execute gates with dependency resolution
   */
  async scheduleGates(
    gates: GateConfiguration[],
    context: GateExecutionContext
  ): Promise<GateResult[]> {
    const dependencyGraph = this.buildDependencyGraph(gates);
    const executionPlan = this.createExecutionPlan(dependencyGraph);
    
    this.emit('scheduling:planned', { 
      totalGates: gates.length,
      executionLevels: executionPlan.length
    });

    const results: GateResult[] = [];
    
    try {
      // Execute gates level by level
      for (let level = 0; level < executionPlan.length; level++) {
        const levelGates = executionPlan[level];
        
        this.emit('scheduling:level_started', { 
          level, 
          gateCount: levelGates.length,
          gateIds: levelGates.map(g => g.id)
        });

        // Check if we should stop due to previous failures
        if (this.shouldStopExecution(results)) {
          // Skip remaining gates
          const skippedResults = await this.skipRemainingGates(
            gates.filter(g => !results.some(r => r.gateId === g.id)),
            'Previous gate failures'
          );
          results.push(...skippedResults);
          break;
        }

        // Execute gates in parallel within the level
        const levelResults = await this.executeParallel(levelGates, context);
        results.push(...levelResults);

        this.emit('scheduling:level_completed', { 
          level, 
          results: levelResults.map(r => ({ id: r.gateId, status: r.status }))
        });
      }
    } catch (error) {
      // Handle execution errors
      const remainingGates = gates.filter(g => 
        !results.some(r => r.gateId === g.id)
      );
      
      const errorResults = await this.skipRemainingGates(
        remainingGates,
        `Execution error: ${error}`
      );
      results.push(...errorResults);
    }

    return results;
  }

  /**
   * Execute gates in parallel
   */
  async executeParallel(
    gates: GateConfiguration[],
    context: GateExecutionContext
  ): Promise<GateResult[]> {
    const maxParallel = this.options.maxParallel || 3;
    const chunks = this.chunkArray(gates, maxParallel);
    const results: GateResult[] = [];

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(gate => 
        this.executeSingleGate(gate, context)
      );
      
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      for (let i = 0; i < chunkResults.length; i++) {
        const result = chunkResults[i];
        const gate = chunk[i];
        
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Create error result for failed execution
          results.push(this.createErrorResult(gate, result.reason));
        }
      }
    }

    return results;
  }

  /**
   * Execute gates sequentially with dependencies
   */
  async executeSequential(
    gates: GateConfiguration[],
    context: GateExecutionContext
  ): Promise<GateResult[]> {
    const results: GateResult[] = [];
    
    for (const gate of gates) {
      if (this.shouldStopExecution(results)) {
        const skipped = await this.createSkippedResult(gate, 'Previous gate failures');
        results.push(skipped);
        continue;
      }
      
      try {
        const result = await this.executeSingleGate(gate, context);
        results.push(result);
      } catch (error) {
        const errorResult = this.createErrorResult(gate, error as Error);
        results.push(errorResult);
      }
    }
    
    return results;
  }

  /**
   * Execute a single gate with timeout and retry logic
   */
  private async executeSingleGate(
    gate: GateConfiguration,
    context: GateExecutionContext
  ): Promise<GateResult> {
    const executor = this.executors.get(gate.id);
    if (!executor) {
      throw new Error(`No executor registered for gate: ${gate.id}`);
    }

    // Check if gate should be skipped
    if (executor.shouldSkip(gate, context)) {
      return this.createSkippedResult(gate, 'Gate conditions not met');
    }

    const startTime = Date.now();
    let lastError: Error | undefined;

    // Retry logic
    for (let attempt = 0; attempt <= gate.retry.maxRetries; attempt++) {
      try {
        this.emit('gate:started', { gateId: gate.id, attempt });

        // Execute with timeout
        const result = await this.executeWithTimeout(
          () => executor.executeGate(gate, context),
          gate.timeout
        );

        this.emit('gate:completed', { gateId: gate.id, status: result.status });
        return result;

      } catch (error) {
        lastError = error as Error;
        this.emit('gate:attempt_failed', { 
          gateId: gate.id, 
          attempt, 
          error: lastError.message 
        });

        // Apply retry delay if not the last attempt
        if (attempt < gate.retry.maxRetries) {
          const delay = gate.retry.exponentialBackoff 
            ? gate.retry.delay * Math.pow(2, attempt)
            : gate.retry.delay;
          
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed
    return this.createErrorResult(gate, lastError!);
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Gate execution timed out after ${timeout}ms`));
      }, timeout);

      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  /**
   * Register a gate executor
   */
  registerExecutor(gateId: string, executor: GateExecutor): void {
    this.executors.set(gateId, executor);
  }

  /**
   * Validate gate configurations
   */
  private validateGateConfiguration(gates: GateConfiguration[]): void {
    const errors: string[] = [];
    
    // Check for duplicate gate IDs
    const gateIds = gates.map(g => g.id);
    const duplicateIds = gateIds.filter((id, index) => gateIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate gate IDs found: ${duplicateIds.join(', ')}`);
    }

    // Check dependencies
    for (const gate of gates) {
      for (const depId of gate.dependencies) {
        if (!gateIds.includes(depId)) {
          errors.push(`Gate ${gate.id} depends on non-existent gate: ${depId}`);
        }
      }
    }

    // Check for circular dependencies
    const hasCyclicalDependencies = this.detectCyclesInDependencies(gates);
    if (hasCyclicalDependencies) {
      errors.push('Circular dependencies detected in gate configuration');
    }

    if (errors.length > 0) {
      throw new Error(`Gate configuration validation failed: ${errors.join('; ')}`);
    }
  }

  /**
   * Build dependency graph from gate configurations
   */
  private buildDependencyGraph(gates: GateConfiguration[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const gate of gates) {
      graph.set(gate.id, gate.dependencies);
    }
    
    return graph;
  }

  /**
   * Create execution plan based on dependency graph
   */
  private createExecutionPlan(dependencyGraph: Map<string, string[]>): GateConfiguration[][] {
    const plan: GateConfiguration[][] = [];
    const remaining = new Set(dependencyGraph.keys());
    const completed = new Set<string>();

    while (remaining.size > 0) {
      const levelGates: GateConfiguration[] = [];
      
      // Find gates with no pending dependencies
      for (const gateId of remaining) {
        const dependencies = dependencyGraph.get(gateId) || [];
        const pendingDeps = dependencies.filter(dep => !completed.has(dep));
        
        if (pendingDeps.length === 0) {
          // Get gate configuration
          const gate = this.findGateById(gateId);
          if (gate) {
            levelGates.push(gate);
          }
        }
      }

      if (levelGates.length === 0) {
        throw new Error('Circular dependency detected or invalid dependency graph');
      }

      // Add level to plan and mark gates as completed
      plan.push(levelGates);
      for (const gate of levelGates) {
        remaining.delete(gate.id);
        completed.add(gate.id);
      }
    }

    return plan;
  }

  /**
   * Find gate configuration by ID
   */
  private findGateById(gateId: string): GateConfiguration | undefined {
    // This would typically be retrieved from the configuration manager
    // For now, return undefined to avoid circular dependency issues
    return undefined;
  }

  /**
   * Check if execution should stop due to failures
   */
  private shouldStopExecution(results: GateResult[]): boolean {
    if (!this.options.failFast) {
      return false;
    }

    return results.some(result => 
      result.status === GateStatus.FAILED || result.status === GateStatus.ERROR
    );
  }

  /**
   * Skip remaining gates
   */
  private async skipRemainingGates(
    gates: GateConfiguration[],
    reason: string
  ): Promise<GateResult[]> {
    return Promise.all(
      gates.map(gate => this.createSkippedResult(gate, reason))
    );
  }

  /**
   * Create skipped result
   */
  private async createSkippedResult(gate: GateConfiguration, reason: string): Promise<GateResult> {
    const now = new Date();
    return {
      gateId: gate.id,
      name: gate.name,
      status: GateStatus.SKIPPED,
      startTime: now,
      endTime: now,
      duration: 0,
      details: {
        summary: `Gate skipped: ${reason}`,
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
  private createErrorResult(gate: GateConfiguration, error: Error): GateResult {
    const now = new Date();
    return {
      gateId: gate.id,
      name: gate.name,
      status: GateStatus.ERROR,
      startTime: now,
      endTime: now,
      duration: 0,
      details: {
        summary: `Gate execution failed: ${error.message}`,
        findings: [{
          severity: 'error',
          category: 'execution',
          message: error.message,
          rule: 'gate-execution'
        }],
        recommendations: ['Check gate configuration and execution environment'],
        reportUrls: []
      },
      error: {
        code: 'EXECUTION_ERROR',
        message: error.message,
        details: error.stack
      },
      metrics: {}
    };
  }

  /**
   * Generate execution report
   */
  private generateExecutionReport(
    reportId: string,
    context: GateExecutionContext,
    results: GateResult[],
    config: GateConfigurationSet,
    startTime: number
  ): GateExecutionReport {
    const endTime = performance.now();
    const summary = this.generateExecutionSummary(results);
    const qualityScore = this.calculateQualityScore(results, config);
    const mergeRecommendation = this.generateMergeRecommendation(results);

    return {
      id: reportId,
      timestamp: new Date(),
      context,
      status: this.determineOverallStatus(results),
      gateResults: results,
      summary,
      qualityScore,
      mergeRecommendation
    };
  }

  /**
   * Generate error report
   */
  private generateErrorReport(
    reportId: string,
    context: GateExecutionContext,
    error: Error,
    startTime: number
  ): GateExecutionReport {
    const endTime = performance.now();
    
    return {
      id: reportId,
      timestamp: new Date(),
      context,
      status: GateStatus.ERROR,
      gateResults: [],
      summary: {
        totalGates: 0,
        passedGates: 0,
        failedGates: 0,
        warningGates: 0,
        skippedGates: 0,
        totalDuration: endTime - startTime
      },
      qualityScore: 0,
      mergeRecommendation: {
        allowed: false,
        reason: `Execution failed: ${error.message}`,
        blockingIssues: [error.message],
        warningIssues: []
      }
    };
  }

  /**
   * Generate execution summary
   */
  private generateExecutionSummary(results: GateResult[]): ExecutionSummary {
    return {
      totalGates: results.length,
      passedGates: results.filter(r => r.status === GateStatus.PASSED).length,
      failedGates: results.filter(r => r.status === GateStatus.FAILED).length,
      warningGates: results.filter(r => 
        r.status === GateStatus.PASSED && 
        r.details.findings.some(f => f.severity === 'warning')
      ).length,
      skippedGates: results.filter(r => r.status === GateStatus.SKIPPED).length,
      totalDuration: results.reduce((total, result) => total + result.duration, 0)
    };
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(
    results: GateResult[],
    config: GateConfigurationSet
  ): number {
    if (results.length === 0) return 0;

    const weights = {
      [GateStatus.PASSED]: 1.0,
      [GateStatus.FAILED]: 0.0,
      [GateStatus.ERROR]: 0.0,
      [GateStatus.SKIPPED]: 0.5,
      [GateStatus.PENDING]: 0.0,
      [GateStatus.RUNNING]: 0.0
    };

    const totalWeight = results.reduce((sum, result) => sum + weights[result.status], 0);
    const maxWeight = results.length;
    
    return Math.round((totalWeight / maxWeight) * 100);
  }

  /**
   * Generate merge recommendation
   */
  private generateMergeRecommendation(results: GateResult[]): MergeRecommendation {
    const blockingFailures = results.filter(r => 
      r.status === GateStatus.FAILED || r.status === GateStatus.ERROR
    );
    
    const warnings = results.filter(r =>
      r.status === GateStatus.PASSED &&
      r.details.findings.some(f => f.severity === 'warning')
    );

    const allowed = blockingFailures.length === 0;
    
    return {
      allowed,
      reason: allowed 
        ? 'All quality gates passed' 
        : `${blockingFailures.length} gate(s) failed`,
      blockingIssues: blockingFailures.map(r => 
        `${r.name}: ${r.details.summary}`
      ),
      warningIssues: warnings.flatMap(r =>
        r.details.findings
          .filter(f => f.severity === 'warning')
          .map(f => `${r.name}: ${f.message}`)
      )
    };
  }

  /**
   * Determine overall execution status
   */
  private determineOverallStatus(results: GateResult[]): GateStatus {
    if (results.some(r => r.status === GateStatus.ERROR)) {
      return GateStatus.ERROR;
    }
    if (results.some(r => r.status === GateStatus.FAILED)) {
      return GateStatus.FAILED;
    }
    if (results.some(r => r.status === GateStatus.RUNNING)) {
      return GateStatus.RUNNING;
    }
    if (results.some(r => r.status === GateStatus.PENDING)) {
      return GateStatus.PENDING;
    }
    return GateStatus.PASSED;
  }

  /**
   * Detect cycles in dependencies
   */
  private detectCyclesInDependencies(gates: GateConfiguration[]): boolean {
    const graph = new Map<string, string[]>();
    for (const gate of gates) {
      graph.set(gate.id, gate.dependencies);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (gateId: string): boolean => {
      if (recursionStack.has(gateId)) return true;
      if (visited.has(gateId)) return false;

      visited.add(gateId);
      recursionStack.add(gateId);

      const dependencies = graph.get(gateId) || [];
      for (const dep of dependencies) {
        if (hasCycle(dep)) return true;
      }

      recursionStack.delete(gateId);
      return false;
    };

    for (const gateId of graph.keys()) {
      if (hasCycle(gateId)) return true;
    }

    return false;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}