/**
 * Validation Pipeline Orchestrator
 * 
 * Manages the validation workflow: validate → surface → UI gates → contracts → budgets
 * with incremental validation, parallel execution, and intelligent resource management.
 */

import { EventEmitter } from 'events';
import { ResourceManager } from './resource-manager.js';
import { OutputStreamer } from './output-streamer.js';
import { logger } from '../utils/logger.js';
import { FileEvent } from '../watcher/types.js';

export interface ValidationPhase {
  name: string;
  ok: boolean;
  deltas: Array<{
    file: string;
    type: 'add' | 'change' | 'delete';
    timestamp: string;
  }>;
  coverage: {
    contracts: number;
    scenarios: number;
    ui: number;
    budgets: number;
  };
  processingTime: number;
  errors?: Array<{
    file: string;
    message: string;
    line?: number;
  }>;
}

export interface BatchResult {
  batchId: string;
  phases: ValidationPhase[];
  totalProcessingTime: number;
  overallCoverage: {
    contracts: number;
    scenarios: number;
    ui: number;
    budgets: number;
  };
}

export interface ValidationPipelineConfig {
  phases: string[];
  parallel: number;
  fastMode: boolean;
  timeout: number;
  resourceManager: ResourceManager;
  outputStreamer: OutputStreamer;
}

export interface ValidationPipelineEvents {
  'phase-complete': (phase: ValidationPhase) => void;
  'batch-complete': (result: BatchResult) => void;
  'error': (error: Error) => void;
  'pipeline-ready': () => void;
  'pipeline-stopped': () => void;
}

export declare interface ValidationPipeline {
  on<K extends keyof ValidationPipelineEvents>(event: K, listener: ValidationPipelineEvents[K]): this;
  off<K extends keyof ValidationPipelineEvents>(event: K, listener: ValidationPipelineEvents[K]): this;
  emit<K extends keyof ValidationPipelineEvents>(event: K, ...args: Parameters<ValidationPipelineEvents[K]>): boolean;
}

export class ValidationPipeline extends EventEmitter {
  private config: ValidationPipelineConfig;
  private isRunning = false;
  private activeBatches = new Map<string, Promise<void>>();
  private changeBuffer = new Map<string, FileEvent>();
  private bufferTimer: NodeJS.Timeout | null = null;
  private shutdownController = new AbortController();
  
  // Validation state tracking
  private lastValidationState = new Map<string, {
    hash: string;
    timestamp: number;
    result: ValidationPhase;
  }>();

  constructor(config: ValidationPipelineConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the validation pipeline
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('ValidationPipeline is already running');
    }

    logger.info('🚀 Starting validation pipeline...');
    logger.debug(`Pipeline config:`, {
      phases: this.config.phases,
      parallel: this.config.parallel,
      fastMode: this.config.fastMode,
      timeout: this.config.timeout,
    });

    this.isRunning = true;
    this.emit('pipeline-ready');
    
    logger.info('✅ Validation pipeline ready');
  }

  /**
   * Stop the validation pipeline
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('🛑 Stopping validation pipeline...');
    
    this.isRunning = false;
    this.shutdownController.abort();
    
    // Clear buffer timer
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }

    // Wait for active batches to complete (with timeout)
    const activeBatchPromises = Array.from(this.activeBatches.values());
    if (activeBatchPromises.length > 0) {
      logger.info(`⏳ Waiting for ${activeBatchPromises.length} active validation batches...`);
      
      const timeoutPromise = new Promise<void>(resolve => setTimeout(resolve, 5000));
      await Promise.race([
        Promise.allSettled(activeBatchPromises),
        timeoutPromise
      ]);
    }

    this.activeBatches.clear();
    this.changeBuffer.clear();
    
    this.emit('pipeline-stopped');
    logger.info('✅ Validation pipeline stopped');
  }

  /**
   * Process a file change event
   */
  async processFileChange(event: FileEvent): Promise<void> {
    if (!this.isRunning) {
      logger.warn('⚠️ Received file change event but pipeline is not running');
      return;
    }

    // Add to change buffer
    this.changeBuffer.set(event.path, event);

    // Debounce batch processing
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
    }

    this.bufferTimer = setTimeout(() => {
      this.processBatch().catch(error => {
        logger.error('Error processing validation batch:', error);
        this.emit('error', error);
      });
    }, 200); // 200ms debounce
  }

  /**
   * Process accumulated file changes as a batch
   */
  private async processBatch(): Promise<void> {
    if (this.changeBuffer.size === 0) {
      return;
    }

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const changes = Array.from(this.changeBuffer.values());
    this.changeBuffer.clear();

    logger.debug(`📦 Processing validation batch ${batchId} with ${changes.length} changes`);

    // Check resource limits before starting
    if (!this.config.resourceManager.checkResourceLimits()) {
      logger.warn('⚠️ Resource limits exceeded, deferring batch validation');
      return;
    }

    const batchPromise = this.executeBatch(batchId, changes);
    this.activeBatches.set(batchId, batchPromise);

    try {
      await batchPromise;
    } finally {
      this.activeBatches.delete(batchId);
    }
  }

  /**
   * Execute a validation batch
   */
  private async executeBatch(batchId: string, changes: FileEvent[]): Promise<void> {
    const startTime = Date.now();
    const phases: ValidationPhase[] = [];
    
    try {
      // Determine which files need validation
      const filesToValidate = this.config.fastMode 
        ? this.getIncrementalFiles(changes)
        : this.getAllAffectedFiles(changes);

      if (filesToValidate.size === 0) {
        logger.debug(`📦 Batch ${batchId}: No files need validation`);
        return;
      }

      logger.debug(`📦 Batch ${batchId}: Validating ${filesToValidate.size} files`);

      // Execute phases based on configuration
      for (const phaseName of this.config.phases) {
        if (this.shutdownController.signal.aborted) {
          break;
        }

        const phase = await this.executePhase(phaseName, filesToValidate, changes);
        phases.push(phase);
        
        this.emit('phase-complete', phase);
        
        // Early exit if critical phase fails and not in fast mode
        if (!phase.ok && !this.config.fastMode && this.isCriticalPhase(phaseName)) {
          logger.warn(`⚠️ Critical phase ${phaseName} failed, stopping batch`);
          break;
        }
      }

      // Calculate overall results
      const totalProcessingTime = Date.now() - startTime;
      const batchResult: BatchResult = {
        batchId,
        phases,
        totalProcessingTime,
        overallCoverage: this.calculateOverallCoverage(phases),
      };

      this.emit('batch-complete', batchResult);
      
      logger.debug(`📦 Batch ${batchId} completed in ${totalProcessingTime}ms`);

    } catch (error) {
      logger.error(`❌ Batch ${batchId} failed:`, error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Execute a single validation phase
   */
  private async executePhase(
    phaseName: string, 
    filesToValidate: Set<string>, 
    changes: FileEvent[]
  ): Promise<ValidationPhase> {
    const startTime = Date.now();
    
    logger.debug(`🔍 Executing phase: ${phaseName}`);

    try {
      const result = await this.runPhaseValidator(phaseName, filesToValidate, changes);
      const processingTime = Date.now() - startTime;

      const phase: ValidationPhase = {
        name: phaseName,
        ok: result.ok,
        deltas: changes.map(change => ({
          file: change.path,
          type: change.type as 'add' | 'change' | 'delete',
          timestamp: change.timestamp.toISOString(),
        })),
        coverage: result.coverage,
        processingTime,
        errors: result.errors,
      };

      // Update validation state cache for incremental validation
      if (result.ok && this.config.fastMode) {
        this.updateValidationStateCache(filesToValidate, phase);
      }

      return phase;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        name: phaseName,
        ok: false,
        deltas: changes.map(change => ({
          file: change.path,
          type: change.type as 'add' | 'change' | 'delete',
          timestamp: change.timestamp.toISOString(),
        })),
        coverage: { contracts: 0, scenarios: 0, ui: 0, budgets: 0 },
        processingTime,
        errors: [{
          file: 'system',
          message: error instanceof Error ? error.message : String(error),
        }],
      };
    }
  }

  /**
   * Run the actual validator for a specific phase
   */
  private async runPhaseValidator(
    phaseName: string,
    filesToValidate: Set<string>,
    changes: FileEvent[]
  ): Promise<{
    ok: boolean;
    coverage: { contracts: number; scenarios: number; ui: number; budgets: number };
    errors?: Array<{ file: string; message: string; line?: number }>;
  }> {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Phase ${phaseName} timed out after ${this.config.timeout}ms`)), this.config.timeout);
    });

    // Create the actual validation promise
    const validationPromise = this.executePhaseLogic(phaseName, filesToValidate, changes);

    // Race between validation and timeout
    return await Promise.race([validationPromise, timeoutPromise]);
  }

  /**
   * Execute the core logic for each validation phase
   */
  private async executePhaseLogic(
    phaseName: string,
    filesToValidate: Set<string>,
    changes: FileEvent[]
  ): Promise<{
    ok: boolean;
    coverage: { contracts: number; scenarios: number; ui: number; budgets: number };
    errors?: Array<{ file: string; message: string; line?: number }>;
  }> {
    switch (phaseName) {
      case 'validate':
        return await this.runCueValidation(filesToValidate);
      
      case 'surface':
        return await this.runSurfaceAnalysis(filesToValidate);
      
      case 'ui':
        return await this.runUIValidation(filesToValidate);
      
      case 'contracts':
        return await this.runContractValidation(filesToValidate);
      
      case 'budgets':
        return await this.runBudgetValidation(filesToValidate);
      
      default:
        throw new Error(`Unknown validation phase: ${phaseName}`);
    }
  }

  /**
   * CUE file validation
   */
  private async runCueValidation(filesToValidate: Set<string>): Promise<{
    ok: boolean;
    coverage: { contracts: number; scenarios: number; ui: number; budgets: number };
    errors?: Array<{ file: string; message: string; line?: number }>;
  }> {
    // Placeholder implementation - would integrate with actual CUE validation
    const errors: Array<{ file: string; message: string; line?: number }> = [];
    
    for (const file of filesToValidate) {
      if (file.endsWith('.cue')) {
        // Simulate CUE validation
        if (Math.random() < 0.1) { // 10% chance of error for simulation
          errors.push({
            file,
            message: 'CUE validation error: invalid syntax',
            line: Math.floor(Math.random() * 100) + 1,
          });
        }
      }
    }

    return {
      ok: errors.length === 0,
      coverage: { contracts: 0, scenarios: 0, ui: 0, budgets: 0 },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * API surface analysis
   */
  private async runSurfaceAnalysis(filesToValidate: Set<string>): Promise<{
    ok: boolean;
    coverage: { contracts: number; scenarios: number; ui: number; budgets: number };
    errors?: Array<{ file: string; message: string; line?: number }>;
  }> {
    // Placeholder implementation - would analyze API surfaces
    return {
      ok: true,
      coverage: { contracts: 0, scenarios: 0, ui: 0, budgets: 0 },
    };
  }

  /**
   * UI profile validation
   */
  private async runUIValidation(filesToValidate: Set<string>): Promise<{
    ok: boolean;
    coverage: { contracts: number; scenarios: number; ui: number; budgets: number };
    errors?: Array<{ file: string; message: string; line?: number }>;
  }> {
    // Placeholder implementation - would validate UI profiles
    const uiFiles = Array.from(filesToValidate).filter(f => f.includes('ui') || f.includes('profile'));
    const coverage = Math.min(1.0, uiFiles.length * 0.2);

    return {
      ok: true,
      coverage: { contracts: 0, scenarios: 0, ui: coverage, budgets: 0 },
    };
  }

  /**
   * Contract validation
   */
  private async runContractValidation(filesToValidate: Set<string>): Promise<{
    ok: boolean;
    coverage: { contracts: number; scenarios: number; ui: number; budgets: number };
    errors?: Array<{ file: string; message: string; line?: number }>;
  }> {
    // Placeholder implementation - would validate contracts
    const contractFiles = Array.from(filesToValidate).filter(f => f.includes('contract'));
    const contractCoverage = Math.min(1.0, contractFiles.length * 0.3);
    const scenarioCoverage = Math.min(1.0, contractFiles.length * 0.25);

    return {
      ok: true,
      coverage: { contracts: contractCoverage, scenarios: scenarioCoverage, ui: 0, budgets: 0 },
    };
  }

  /**
   * Budget validation
   */
  private async runBudgetValidation(filesToValidate: Set<string>): Promise<{
    ok: boolean;
    coverage: { contracts: number; scenarios: number; ui: number; budgets: number };
    errors?: Array<{ file: string; message: string; line?: number }>;
  }> {
    // Placeholder implementation - would validate resource budgets
    const budgetCoverage = 0.9; // Assume 90% budget compliance
    
    return {
      ok: budgetCoverage >= 0.8,
      coverage: { contracts: 0, scenarios: 0, ui: 0, budgets: budgetCoverage },
    };
  }

  /**
   * Get files for incremental validation (fast mode)
   */
  private getIncrementalFiles(changes: FileEvent[]): Set<string> {
    const filesToValidate = new Set<string>();
    
    for (const change of changes) {
      // Only validate if file has actually changed or is new
      const cachedState = this.lastValidationState.get(change.path);
      
      if (!cachedState || this.hasFileReallyChanged(change, cachedState)) {
        filesToValidate.add(change.path);
        
        // Add dependent files
        const dependencies = this.getDependentFiles(change.path);
        dependencies.forEach(dep => filesToValidate.add(dep));
      }
    }

    return filesToValidate;
  }

  /**
   * Get all affected files (full validation mode)
   */
  private getAllAffectedFiles(changes: FileEvent[]): Set<string> {
    const filesToValidate = new Set<string>();
    
    for (const change of changes) {
      filesToValidate.add(change.path);
      
      // Add all dependent files
      const dependencies = this.getDependentFiles(change.path);
      dependencies.forEach(dep => filesToValidate.add(dep));
    }

    return filesToValidate;
  }

  /**
   * Check if a file has really changed (beyond just timestamp)
   */
  private hasFileReallyChanged(change: FileEvent, cachedState: any): boolean {
    // In a real implementation, this would compare file hashes
    // For now, assume all changes are real changes
    return true;
  }

  /**
   * Get files that depend on the given file
   */
  private getDependentFiles(filePath: string): string[] {
    // Placeholder implementation - would use dependency graph
    // For now, return empty array
    return [];
  }

  /**
   * Update validation state cache
   */
  private updateValidationStateCache(filesToValidate: Set<string>, phase: ValidationPhase): void {
    const timestamp = Date.now();
    
    for (const file of filesToValidate) {
      this.lastValidationState.set(file, {
        hash: 'placeholder-hash', // Would be actual file hash
        timestamp,
        result: phase,
      });
    }
  }

  /**
   * Check if a phase is critical (should stop batch on failure)
   */
  private isCriticalPhase(phaseName: string): boolean {
    return phaseName === 'validate';
  }

  /**
   * Calculate overall coverage from all phases
   */
  private calculateOverallCoverage(phases: ValidationPhase[]) {
    const coverage = { contracts: 0, scenarios: 0, ui: 0, budgets: 0 };
    
    if (phases.length === 0) {
      return coverage;
    }

    // Average coverage across all phases
    for (const phase of phases) {
      coverage.contracts += phase.coverage.contracts;
      coverage.scenarios += phase.coverage.scenarios;
      coverage.ui += phase.coverage.ui;
      coverage.budgets += phase.coverage.budgets;
    }

    coverage.contracts /= phases.length;
    coverage.scenarios /= phases.length;
    coverage.ui /= phases.length;
    coverage.budgets /= phases.length;

    return coverage;
  }
}

/**
 * Create and configure a validation pipeline
 */
export function createValidationPipeline(config: ValidationPipelineConfig): ValidationPipeline {
  return new ValidationPipeline(config);
}

export type { ValidationPipelineConfig, ValidationPhase, BatchResult };