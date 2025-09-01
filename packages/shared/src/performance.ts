/**
 * @fileoverview Performance & Incremental Validation System v1.0 RC
 * Implements comprehensive performance optimization with caching, worker pools,
 * and batching to meet 750ms end-to-end budget per arbiter.assembly.cue specification
 */

import { z } from 'zod';
import { EventEmitter } from 'events';

// =============================================================================
// PERFORMANCE CONFIGURATION SCHEMA
// =============================================================================

/**
 * Performance budgets and SLO configuration
 */
export const PerformanceBudgetSchema = z.object({
  payload_size_max_bytes: z.number().default(64 * 1024), // 64KB
  end_to_end_max_ms: z.number().default(750), // 750ms total budget
  target_latency_ms: z.number().default(400), // Target well below budget
  watch_loop_rate_rps: z.number().default(1), // 1 request per second
  
  // SLO targets
  ticket_verify_p95_ms: z.number().default(25),
  full_validate_p95_ms: z.number().default(400),
  stream_start_max_ms: z.number().default(100),
  false_negatives: z.number().default(0) // Zero tolerance in golden set
}).strict();

export type PerformanceBudget = z.infer<typeof PerformanceBudgetSchema>;

/**
 * Incremental validation configuration
 */
export const IncrementalValidationConfigSchema = z.object({
  cache_compiled_cue: z.boolean().default(true),
  cache_contract_bytecode: z.boolean().default(true),
  validate_changed_only: z.boolean().default(true),
  
  // Batching configuration
  batch_coalesce_window_ms: z.number().min(100).max(200).default(150),
  batch_per_package: z.boolean().default(true),
  batch_per_module: z.boolean().default(true),
  
  // Worker pool configuration
  per_rule_workers: z.boolean().default(true),
  back_pressure_control: z.boolean().default(true),
  cpu_core_limit: z.boolean().default(true),
  max_workers: z.number().optional(),
  
  // Caching configuration
  lru_ui_profiles: z.boolean().default(true),
  lru_contract_bytecode: z.boolean().default(true),
  lru_design_tokens: z.boolean().default(true),
  warm_common_rulesets: z.boolean().default(true),
  
  // Fast path optimizations
  content_hash_shortcuts: z.boolean().default(true),
  memory_mapped_reads: z.boolean().default(true),
  avoid_extra_copies: z.boolean().default(true),
  canonicalize_once: z.boolean().default(true)
}).strict();

export type IncrementalValidationConfig = z.infer<typeof IncrementalValidationConfigSchema>;

/**
 * Performance metrics tracking
 */
export const PerformanceMetricsSchema = z.object({
  operation: z.string(),
  start_time: z.number(),
  end_time: z.number(),
  duration_ms: z.number(),
  stage_timers: z.record(z.string(), z.number()),
  cache_hits: z.number().default(0),
  cache_misses: z.number().default(0),
  items_processed: z.number().default(1),
  bytes_processed: z.number().default(0)
}).strict();

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

// =============================================================================
// PERFORMANCE TIMER & METRICS
// =============================================================================

/**
 * High-precision performance timer with stage tracking
 */
export class PerformanceTimer {
  private startTime: number;
  private stages: Map<string, { start: number; duration?: number }> = new Map();
  private currentStage: string | null = null;
  
  constructor(private operation: string) {
    this.startTime = performance.now();
  }
  
  /**
   * Start timing a specific stage
   */
  startStage(stageName: string): void {
    this.endCurrentStage();
    this.currentStage = stageName;
    this.stages.set(stageName, { start: performance.now() });
  }
  
  /**
   * End current stage timing
   */
  endStage(): void {
    this.endCurrentStage();
  }
  
  /**
   * Complete timing and return metrics
   */
  complete(cacheStats?: { hits: number; misses: number }): PerformanceMetrics {
    this.endCurrentStage();
    
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    
    const stageTimers: Record<string, number> = {};
    for (const [stageName, stage] of this.stages.entries()) {
      if (stage.duration !== undefined) {
        stageTimers[stageName] = stage.duration;
      }
    }
    
    return {
      operation: this.operation,
      start_time: this.startTime,
      end_time: endTime,
      duration_ms: duration,
      stage_timers: stageTimers,
      cache_hits: cacheStats?.hits || 0,
      cache_misses: cacheStats?.misses || 0,
      items_processed: 1,
      bytes_processed: 0
    };
  }
  
  private endCurrentStage(): void {
    if (this.currentStage) {
      const stage = this.stages.get(this.currentStage);
      if (stage && stage.duration === undefined) {
        stage.duration = performance.now() - stage.start;
      }
      this.currentStage = null;
    }
  }
}

// =============================================================================
// LRU CACHE IMPLEMENTATION
// =============================================================================

/**
 * High-performance LRU cache with TTL support
 */
export class LRUCache<K, V> {
  private cache: Map<K, { value: V; timestamp: number; accessCount: number }> = new Map();
  private maxSize: number;
  private ttlMs: number;
  private hits = 0;
  private misses = 0;
  
  constructor(maxSize: number = 1000, ttlMs: number = 300000) { // 5 minute default TTL
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }
  
  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return undefined;
    }
    
    // Check TTL
    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }
    
    // Update access count and move to end (most recently used)
    entry.accessCount++;
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    this.hits++;
    return entry.value;
  }
  
  /**
   * Set value in cache
   */
  set(key: K, value: V): void {
    const now = Date.now();
    
    // If at capacity, remove least recently used
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: now,
      accessCount: 0
    });
  }
  
  /**
   * Clear expired entries
   */
  evictExpired(): number {
    const now = Date.now();
    let evicted = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        evicted++;
      }
    }
    
    return evicted;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { hits: number; misses: number; size: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0
    };
  }
  
  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

// =============================================================================
// CONTENT HASH CACHE
// =============================================================================

/**
 * Content-addressable cache using SHA-256 hashes
 */
export class ContentHashCache<V> {
  private cache = new LRUCache<string, V>(10000, 600000); // 10k items, 10 min TTL
  
  /**
   * Generate content hash key
   */
  private async generateHash(content: string | Buffer): Promise<string> {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }
  
  /**
   * Get cached value by content
   */
  async get(content: string | Buffer): Promise<V | undefined> {
    const hash = await this.generateHash(content);
    return this.cache.get(hash);
  }
  
  /**
   * Cache value by content
   */
  async set(content: string | Buffer, value: V): Promise<void> {
    const hash = await this.generateHash(content);
    this.cache.set(hash, value);
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }
}

// =============================================================================
// BATCH PROCESSOR
// =============================================================================

/**
 * Event batching and coalescing processor
 */
export class BatchProcessor<T, R> extends EventEmitter {
  private pendingItems: T[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private processing = false;
  
  constructor(
    private config: IncrementalValidationConfig,
    private processor: (items: T[]) => Promise<R[]>
  ) {
    super();
  }
  
  /**
   * Add item to batch for processing
   */
  addItem(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const wrappedItem = {
        item,
        resolve,
        reject
      } as any;
      
      this.pendingItems.push(wrappedItem);
      this.scheduleBatch();
    });
  }
  
  /**
   * Schedule batch processing
   */
  private scheduleBatch(): void {
    if (this.batchTimer) {
      return; // Already scheduled
    }
    
    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.config.batch_coalesce_window_ms);
  }
  
  /**
   * Process current batch
   */
  private async processBatch(): Promise<void> {
    if (this.processing || this.pendingItems.length === 0) {
      return;
    }
    
    this.processing = true;
    this.batchTimer = null;
    
    const batchItems = this.pendingItems.splice(0);
    
    try {
      const items = batchItems.map((wrapped: any) => wrapped.item);
      const results = await this.processor(items);
      
      // Resolve all promises with corresponding results
      batchItems.forEach((wrapped: any, index) => {
        if (results[index] !== undefined) {
          wrapped.resolve(results[index]);
        } else {
          wrapped.reject(new Error(`Batch processing failed for item ${index}`));
        }
      });
      
    } catch (error) {
      // Reject all promises with the error
      batchItems.forEach((wrapped: any) => {
        wrapped.reject(error);
      });
    } finally {
      this.processing = false;
      
      // If more items arrived during processing, schedule another batch
      if (this.pendingItems.length > 0) {
        this.scheduleBatch();
      }
    }
  }
  
  /**
   * Force immediate batch processing
   */
  async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    await this.processBatch();
  }
}

// =============================================================================
// WORKER POOL
// =============================================================================

/**
 * Worker pool for parallel processing
 */
export class WorkerPool<T, R> {
  private workers: Array<{ busy: boolean; process: (item: T) => Promise<R> }> = [];
  private queue: Array<{ item: T; resolve: (result: R) => void; reject: (error: Error) => void }> = [];
  private maxWorkers: number;
  
  constructor(
    private config: IncrementalValidationConfig,
    private workerFactory: () => (item: T) => Promise<R>
  ) {
    // Determine worker count based on CPU cores
    const cpuCores = require('os').cpus().length;
    this.maxWorkers = config.max_workers || Math.min(cpuCores, 8);
    
    // Initialize workers
    for (let i = 0; i < this.maxWorkers; i++) {
      this.workers.push({
        busy: false,
        process: this.workerFactory()
      });
    }
  }
  
  /**
   * Submit work item to pool
   */
  async submit(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      this.scheduleWork();
    });
  }
  
  /**
   * Schedule work to available workers
   */
  private scheduleWork(): void {
    while (this.queue.length > 0) {
      const availableWorker = this.workers.find(w => !w.busy);
      if (!availableWorker) {
        break; // No available workers
      }
      
      const workItem = this.queue.shift()!;
      availableWorker.busy = true;
      
      availableWorker.process(workItem.item)
        .then(result => {
          workItem.resolve(result);
        })
        .catch(error => {
          workItem.reject(error);
        })
        .finally(() => {
          availableWorker.busy = false;
          this.scheduleWork(); // Process next item
        });
    }
  }
  
  /**
   * Wait for all pending work to complete
   */
  async drain(): Promise<void> {
    while (this.queue.length > 0 || this.workers.some(w => w.busy)) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  /**
   * Get pool statistics
   */
  getStats(): { totalWorkers: number; busyWorkers: number; queueSize: number } {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter(w => w.busy).length,
      queueSize: this.queue.length
    };
  }
}

// =============================================================================
// INCREMENTAL VALIDATION ENGINE
// =============================================================================

/**
 * Main incremental validation engine
 */
export class IncrementalValidationEngine {
  private cueCache = new ContentHashCache<any>();
  private contractCache = new LRUCache<string, any>(1000, 300000);
  private profileCache = new LRUCache<string, any>(500, 600000);
  private designTokenCache = new LRUCache<string, any>(100, 900000);
  
  private batchProcessor: BatchProcessor<ValidationTask, ValidationResult>;
  private workerPool: WorkerPool<ValidationTask, ValidationResult>;
  
  constructor(
    private config: IncrementalValidationConfig,
    private budget: PerformanceBudget
  ) {
    this.batchProcessor = new BatchProcessor(
      config,
      this.processBatch.bind(this)
    );
    
    this.workerPool = new WorkerPool(
      config,
      () => this.createWorker.bind(this)
    );
  }
  
  /**
   * Validate content with incremental optimizations
   */
  async validate(
    content: string,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const timer = new PerformanceTimer('incremental_validate');
    
    try {
      timer.startStage('content_hash');
      
      // Fast path: Check content hash cache
      if (this.config.content_hash_shortcuts) {
        const cachedResult = await this.cueCache.get(content);
        if (cachedResult) {
          timer.endStage();
          const metrics = timer.complete(this.cueCache.getStats());
          return {
            ...cachedResult,
            cached: true,
            performance_metrics: metrics
          };
        }
      }
      
      timer.startStage('canonicalization');
      
      // Canonicalize once and reuse
      const canonicalContent = this.config.canonicalize_once
        ? this.canonicalize(content)
        : content;
      
      timer.startStage('batch_processing');
      
      // Use batch processing for efficiency
      const task: ValidationTask = {
        content: canonicalContent,
        options,
        timestamp: Date.now()
      };
      
      const result = options.batch
        ? await this.batchProcessor.addItem(task)
        : await this.workerPool.submit(task);
      
      timer.endStage();
      
      // Cache the result
      if (this.config.content_hash_shortcuts) {
        await this.cueCache.set(content, result);
      }
      
      const metrics = timer.complete();
      return {
        ...result,
        cached: false,
        performance_metrics: metrics
      };
      
    } catch (error) {
      const metrics = timer.complete();
      throw new ValidationError(
        error instanceof Error ? error.message : 'Unknown validation error',
        metrics
      );
    }
  }
  
  /**
   * Create worker function
   */
  private createWorker(task: ValidationTask): Promise<ValidationResult> {
    return this.processTask(task);
  }
  
  /**
   * Process batch of validation tasks
   */
  private async processBatch(tasks: ValidationTask[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const task of tasks) {
      try {
        const result = await this.processTask(task);
        results.push(result);
      } catch (error) {
        results.push({
          valid: false,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: [],
          timestamp: Date.now()
        });
      }
    }
    
    return results;
  }
  
  /**
   * Process individual validation task
   */
  private async processTask(task: ValidationTask): Promise<ValidationResult> {
    // Simulate validation processing
    // In real implementation, this would:
    // 1. Parse CUE content
    // 2. Apply contract rules
    // 3. Check constraints
    // 4. Generate violations/warnings
    
    const processingTime = Math.random() * 50; // Simulate 0-50ms processing
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    return {
      valid: true,
      errors: [],
      warnings: [],
      timestamp: Date.now()
    };
  }
  
  /**
   * Canonicalize content
   */
  private canonicalize(content: string): string {
    // Normalize whitespace and line endings
    return content
      .replace(/\r\n|\r/g, '\n')
      .replace(/\s+$/gm, '')
      .trim() + '\n';
  }
  
  /**
   * Get comprehensive performance statistics
   */
  getStats(): PerformanceStats {
    return {
      cue_cache: this.cueCache.getStats(),
      contract_cache: this.contractCache.getStats(),
      profile_cache: this.profileCache.getStats(),
      design_token_cache: this.designTokenCache.getStats(),
      worker_pool: this.workerPool.getStats()
    };
  }
  
  /**
   * Perform cache maintenance
   */
  performMaintenance(): MaintenanceResult {
    const cueEvicted = this.contractCache.evictExpired();
    const contractEvicted = this.contractCache.evictExpired();
    const profileEvicted = this.profileCache.evictExpired();
    const designTokenEvicted = this.designTokenCache.evictExpired();
    
    return {
      cue_cache_evicted: cueEvicted,
      contract_cache_evicted: contractEvicted,
      profile_cache_evicted: profileEvicted,
      design_token_cache_evicted: designTokenEvicted,
      timestamp: Date.now()
    };
  }
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface ValidationTask {
  content: string;
  options: ValidationOptions;
  timestamp: number;
}

export interface ValidationOptions {
  batch?: boolean;
  timeout_ms?: number;
  cache_enabled?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  timestamp: number;
  cached?: boolean;
  performance_metrics?: PerformanceMetrics;
}

export interface PerformanceStats {
  cue_cache: { hits: number; misses: number; size: number; hitRate: number };
  contract_cache: { hits: number; misses: number; size: number; hitRate: number };
  profile_cache: { hits: number; misses: number; size: number; hitRate: number };
  design_token_cache: { hits: number; misses: number; size: number; hitRate: number };
  worker_pool: { totalWorkers: number; busyWorkers: number; queueSize: number };
}

export interface MaintenanceResult {
  cue_cache_evicted: number;
  contract_cache_evicted: number;
  profile_cache_evicted: number;
  design_token_cache_evicted: number;
  timestamp: number;
}

/**
 * Custom error for validation failures with performance metrics
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public performanceMetrics: PerformanceMetrics
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// =============================================================================
// PERFORMANCE MONITORING
// =============================================================================

/**
 * Performance monitor for SLO tracking
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsHistory = 10000;
  
  /**
   * Record performance metrics
   */
  record(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    // Keep bounded history
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }
  }
  
  /**
   * Get percentile statistics
   */
  getPercentiles(operation?: string): {
    p50: number;
    p95: number;
    p99: number;
    mean: number;
    count: number;
  } {
    const filtered = operation
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics;
    
    if (filtered.length === 0) {
      return { p50: 0, p95: 0, p99: 0, mean: 0, count: 0 };
    }
    
    const durations = filtered.map(m => m.duration_ms).sort((a, b) => a - b);
    const count = durations.length;
    
    return {
      p50: this.percentile(durations, 0.5),
      p95: this.percentile(durations, 0.95),
      p99: this.percentile(durations, 0.99),
      mean: durations.reduce((a, b) => a + b, 0) / count,
      count
    };
  }
  
  private percentile(sortedArray: number[], p: number): number {
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, index)];
  }
  
  /**
   * Check SLO violations
   */
  checkSLOs(budget: PerformanceBudget): {
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];
    
    const ticketStats = this.getPercentiles('ticket_verify');
    const validateStats = this.getPercentiles('full_validate');
    
    if (ticketStats.p95 > budget.ticket_verify_p95_ms) {
      violations.push(
        `Ticket verification P95 (${ticketStats.p95.toFixed(1)}ms) exceeds SLO (${budget.ticket_verify_p95_ms}ms)`
      );
    }
    
    if (validateStats.p95 > budget.full_validate_p95_ms) {
      violations.push(
        `Full validation P95 (${validateStats.p95.toFixed(1)}ms) exceeds SLO (${budget.full_validate_p95_ms}ms)`
      );
    }
    
    if (validateStats.p99 > budget.end_to_end_max_ms) {
      violations.push(
        `End-to-end P99 (${validateStats.p99.toFixed(1)}ms) exceeds budget (${budget.end_to_end_max_ms}ms)`
      );
    }
    
    return { violations, warnings };
  }
}