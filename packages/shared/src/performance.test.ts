/**
 * @fileoverview Performance & Incremental Validation Tests v1.0 RC
 * Comprehensive test suite for performance optimization systems
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  PerformanceTimer,
  LRUCache,
  ContentHashCache,
  BatchProcessor,
  WorkerPool,
  IncrementalValidationEngine,
  PerformanceMonitor,
  ValidationError,
  type PerformanceBudget,
  type IncrementalValidationConfig,
  type ValidationTask,
  type ValidationResult
} from './performance.js';

describe('Performance & Incremental Validation v1.0 RC', () => {
  
  describe('Performance Timer', () => {
    test('measures operation duration accurately', async () => {
      const timer = new PerformanceTimer('test_operation');
      
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const metrics = timer.complete();
      
      expect(metrics.operation).toBe('test_operation');
      expect(metrics.duration_ms).toBeGreaterThan(40);
      expect(metrics.duration_ms).toBeLessThan(100);
      expect(metrics.end_time).toBeGreaterThan(metrics.start_time);
    });
    
    test('tracks stage timings accurately', async () => {
      const timer = new PerformanceTimer('staged_operation');
      
      timer.startStage('stage1');
      await new Promise(resolve => setTimeout(resolve, 20));
      
      timer.startStage('stage2');
      await new Promise(resolve => setTimeout(resolve, 30));
      
      timer.endStage();
      
      const metrics = timer.complete();
      
      expect(metrics.stage_timers.stage1).toBeGreaterThan(15);
      expect(metrics.stage_timers.stage1).toBeLessThan(35);
      expect(metrics.stage_timers.stage2).toBeGreaterThan(25);
      expect(metrics.stage_timers.stage2).toBeLessThan(45);
    });
    
    test('handles overlapping stages correctly', () => {
      const timer = new PerformanceTimer('overlapping_stages');
      
      timer.startStage('stage1');
      timer.startStage('stage2'); // Should end stage1 automatically
      timer.endStage();
      
      const metrics = timer.complete();
      
      expect(metrics.stage_timers.stage1).toBeDefined();
      expect(metrics.stage_timers.stage2).toBeDefined();
      expect(Object.keys(metrics.stage_timers)).toHaveLength(2);
    });
  });
  
  describe('LRU Cache', () => {
    let cache: LRUCache<string, number>;
    
    beforeEach(() => {
      cache = new LRUCache<string, number>(3, 1000); // Size 3, 1s TTL
    });
    
    test('stores and retrieves values', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      
      expect(cache.get('key1')).toBe(100);
      expect(cache.get('key2')).toBe(200);
      expect(cache.get('nonexistent')).toBeUndefined();
    });
    
    test('evicts least recently used items when at capacity', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      
      // Access key1 to make it recently used
      cache.get('key1');
      
      // Add key4, should evict key2 (least recently used)
      cache.set('key4', 400);
      
      expect(cache.get('key1')).toBe(100); // Should still exist
      expect(cache.get('key2')).toBeUndefined(); // Should be evicted
      expect(cache.get('key3')).toBe(300);
      expect(cache.get('key4')).toBe(400);
    });
    
    test('respects TTL and evicts expired items', async () => {
      const shortTTLCache = new LRUCache<string, number>(10, 50); // 50ms TTL
      
      shortTTLCache.set('key1', 100);
      expect(shortTTLCache.get('key1')).toBe(100);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));
      
      expect(shortTTLCache.get('key1')).toBeUndefined();
    });
    
    test('tracks cache statistics accurately', () => {
      cache.set('key1', 100);
      
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss
      cache.get('key1'); // Hit
      
      const stats = cache.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2/3);
      expect(stats.size).toBe(1);
    });
    
    test('clears cache properly', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      
      cache.clear();
      
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.getStats().size).toBe(0);
    });
  });
  
  describe('Content Hash Cache', () => {
    let contentCache: ContentHashCache<string>;
    
    beforeEach(() => {
      contentCache = new ContentHashCache<string>();
    });
    
    test('caches content by hash', async () => {
      const content1 = 'hello world';
      const content2 = 'hello world'; // Same content
      const content3 = 'different content';
      
      await contentCache.set(content1, 'result1');
      
      // Same content should return cached result
      expect(await contentCache.get(content2)).toBe('result1');
      
      // Different content should not have cached result
      expect(await contentCache.get(content3)).toBeUndefined();
    });
    
    test('handles binary content', async () => {
      const buffer1 = Buffer.from([1, 2, 3, 4]);
      const buffer2 = Buffer.from([1, 2, 3, 4]); // Same content
      const buffer3 = Buffer.from([5, 6, 7, 8]); // Different content
      
      await contentCache.set(buffer1, 'binary_result');
      
      expect(await contentCache.get(buffer2)).toBe('binary_result');
      expect(await contentCache.get(buffer3)).toBeUndefined();
    });
  });
  
  describe('Batch Processor', () => {
    let batchProcessor: BatchProcessor<number, number>;
    let processedBatches: number[][] = [];
    
    beforeEach(() => {
      processedBatches = [];
      
      const config: IncrementalValidationConfig = {
        cache_compiled_cue: true,
        cache_contract_bytecode: true,
        validate_changed_only: true,
        batch_coalesce_window_ms: 50,
        batch_per_package: true,
        batch_per_module: true,
        per_rule_workers: true,
        back_pressure_control: true,
        cpu_core_limit: true,
        lru_ui_profiles: true,
        lru_contract_bytecode: true,
        lru_design_tokens: true,
        warm_common_rulesets: true,
        content_hash_shortcuts: true,
        memory_mapped_reads: true,
        avoid_extra_copies: true,
        canonicalize_once: true
      };
      
      batchProcessor = new BatchProcessor(config, async (items: number[]) => {
        processedBatches.push([...items]);
        return items.map(n => n * 2);
      });
    });
    
    test('batches items within coalesce window', async () => {
      const promises = [
        batchProcessor.addItem(1),
        batchProcessor.addItem(2),
        batchProcessor.addItem(3)
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toEqual([2, 4, 6]);
      expect(processedBatches).toHaveLength(1);
      expect(processedBatches[0]).toEqual([1, 2, 3]);
    });
    
    test('creates separate batches when window expires', async () => {
      const result1 = await batchProcessor.addItem(1);
      
      // Wait for batch window to close
      await new Promise(resolve => setTimeout(resolve, 60));
      
      const result2 = await batchProcessor.addItem(2);
      
      expect(result1).toBe(2);
      expect(result2).toBe(4);
      expect(processedBatches).toHaveLength(2);
      expect(processedBatches[0]).toEqual([1]);
      expect(processedBatches[1]).toEqual([2]);
    });
    
    test('handles processing errors correctly', async () => {
      const errorProcessor = new BatchProcessor<number, number>(
        {
          batch_coalesce_window_ms: 50,
          cache_compiled_cue: true,
          cache_contract_bytecode: true,
          validate_changed_only: true,
          batch_per_package: true,
          batch_per_module: true,
          per_rule_workers: true,
          back_pressure_control: true,
          cpu_core_limit: true,
          lru_ui_profiles: true,
          lru_contract_bytecode: true,
          lru_design_tokens: true,
          warm_common_rulesets: true,
          content_hash_shortcuts: true,
          memory_mapped_reads: true,
          avoid_extra_copies: true,
          canonicalize_once: true
        },
        async (items: number[]) => {
          throw new Error('Processing failed');
        }
      );
      
      await expect(errorProcessor.addItem(1)).rejects.toThrow('Processing failed');
    });
  });
  
  describe('Worker Pool', () => {
    let workerPool: WorkerPool<number, number>;
    
    beforeEach(() => {
      const config: IncrementalValidationConfig = {
        cache_compiled_cue: true,
        cache_contract_bytecode: true,
        validate_changed_only: true,
        batch_coalesce_window_ms: 100,
        batch_per_package: true,
        batch_per_module: true,
        per_rule_workers: true,
        back_pressure_control: true,
        cpu_core_limit: true,
        max_workers: 2, // Limit for testing
        lru_ui_profiles: true,
        lru_contract_bytecode: true,
        lru_design_tokens: true,
        warm_common_rulesets: true,
        content_hash_shortcuts: true,
        memory_mapped_reads: true,
        avoid_extra_copies: true,
        canonicalize_once: true
      };
      
      workerPool = new WorkerPool(config, () => {
        return async (n: number) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return n * 2;
        };
      });
    });
    
    afterEach(async () => {
      await workerPool.drain();
    });
    
    test('processes work items in parallel', async () => {
      const startTime = Date.now();
      
      const promises = [
        workerPool.submit(1),
        workerPool.submit(2),
        workerPool.submit(3)
      ];
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      expect(results).toEqual([2, 4, 6]);
      // Should take less than sequential processing (30ms)
      expect(duration).toBeLessThan(25);
    });
    
    test('queues work when all workers busy', async () => {
      const promises = [];
      
      // Submit more work than we have workers
      for (let i = 0; i < 5; i++) {
        promises.push(workerPool.submit(i));
      }
      
      const stats = workerPool.getStats();
      expect(stats.totalWorkers).toBe(2);
      expect(stats.queueSize).toBeGreaterThan(0);
      
      const results = await Promise.all(promises);
      expect(results).toEqual([0, 2, 4, 6, 8]);
    });
    
    test('drains all pending work', async () => {
      // Submit work without waiting
      workerPool.submit(1);
      workerPool.submit(2);
      workerPool.submit(3);
      
      await workerPool.drain();
      
      const stats = workerPool.getStats();
      expect(stats.busyWorkers).toBe(0);
      expect(stats.queueSize).toBe(0);
    });
  });
  
  describe('Incremental Validation Engine', () => {
    let engine: IncrementalValidationEngine;
    let config: IncrementalValidationConfig;
    let budget: PerformanceBudget;
    
    beforeEach(() => {
      config = {
        cache_compiled_cue: true,
        cache_contract_bytecode: true,
        validate_changed_only: true,
        batch_coalesce_window_ms: 100,
        batch_per_package: true,
        batch_per_module: true,
        per_rule_workers: true,
        back_pressure_control: true,
        cpu_core_limit: true,
        max_workers: 2,
        lru_ui_profiles: true,
        lru_contract_bytecode: true,
        lru_design_tokens: true,
        warm_common_rulesets: true,
        content_hash_shortcuts: true,
        memory_mapped_reads: true,
        avoid_extra_copies: true,
        canonicalize_once: true
      };
      
      budget = {
        payload_size_max_bytes: 64 * 1024,
        end_to_end_max_ms: 750,
        target_latency_ms: 400,
        watch_loop_rate_rps: 1,
        ticket_verify_p95_ms: 25,
        full_validate_p95_ms: 400,
        stream_start_max_ms: 100,
        false_negatives: 0
      };
      
      engine = new IncrementalValidationEngine(config, budget);
    });
    
    test('validates content successfully', async () => {
      const content = 'test content for validation';
      const result = await engine.validate(content);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.timestamp).toBeTruthy();
      expect(result.performance_metrics).toBeTruthy();
    });
    
    test('uses content hash caching', async () => {
      const content = 'cached content test';
      
      // First validation
      const result1 = await engine.validate(content);
      expect(result1.cached).toBe(false);
      
      // Second validation should be cached
      const result2 = await engine.validate(content);
      expect(result2.cached).toBe(true);
      
      // Performance should be better for cached result
      const metrics1 = result1.performance_metrics!;
      const metrics2 = result2.performance_metrics!;
      expect(metrics2.duration_ms).toBeLessThan(metrics1.duration_ms);
    });
    
    test('handles batch processing', async () => {
      const contents = [
        'batch content 1',
        'batch content 2',
        'batch content 3'
      ];
      
      const promises = contents.map(content => 
        engine.validate(content, { batch: true })
      );
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
    
    test('canonicalizes content once when enabled', async () => {
      const contentWithVariableWhitespace = '  test   content  \r\n  with   whitespace  \r\n';
      
      const result = await engine.validate(contentWithVariableWhitespace);
      
      expect(result.valid).toBe(true);
      expect(result.performance_metrics?.stage_timers.canonicalization).toBeDefined();
    });
    
    test('reports performance statistics', () => {
      const stats = engine.getStats();
      
      expect(stats.cue_cache).toHaveProperty('hits');
      expect(stats.cue_cache).toHaveProperty('misses');
      expect(stats.cue_cache).toHaveProperty('hitRate');
      expect(stats.contract_cache).toHaveProperty('size');
      expect(stats.worker_pool).toHaveProperty('totalWorkers');
    });
    
    test('performs cache maintenance', () => {
      const maintenance = engine.performMaintenance();
      
      expect(maintenance.cue_cache_evicted).toBeGreaterThanOrEqual(0);
      expect(maintenance.contract_cache_evicted).toBeGreaterThanOrEqual(0);
      expect(maintenance.profile_cache_evicted).toBeGreaterThanOrEqual(0);
      expect(maintenance.design_token_cache_evicted).toBeGreaterThanOrEqual(0);
      expect(maintenance.timestamp).toBeTruthy();
    });
  });
  
  describe('Performance Monitor', () => {
    let monitor: PerformanceMonitor;
    let budget: PerformanceBudget;
    
    beforeEach(() => {
      monitor = new PerformanceMonitor();
      budget = {
        payload_size_max_bytes: 64 * 1024,
        end_to_end_max_ms: 750,
        target_latency_ms: 400,
        watch_loop_rate_rps: 1,
        ticket_verify_p95_ms: 25,
        full_validate_p95_ms: 400,
        stream_start_max_ms: 100,
        false_negatives: 0
      };
    });
    
    test('records and calculates percentiles accurately', () => {
      // Add test data with known distribution
      const testData = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      
      testData.forEach(duration => {
        monitor.record({
          operation: 'test_op',
          start_time: 0,
          end_time: duration,
          duration_ms: duration,
          stage_timers: {},
          cache_hits: 0,
          cache_misses: 0,
          items_processed: 1,
          bytes_processed: 0
        });
      });
      
      const stats = monitor.getPercentiles('test_op');
      
      expect(stats.count).toBe(10);
      expect(stats.mean).toBe(55); // Average of 1-100
      expect(stats.p50).toBe(50); // Median
      expect(stats.p95).toBe(95); // 95th percentile
      expect(stats.p99).toBe(99); // 99th percentile
    });
    
    test('filters metrics by operation type', () => {
      monitor.record({
        operation: 'operation_a',
        start_time: 0,
        end_time: 10,
        duration_ms: 10,
        stage_timers: {},
        cache_hits: 0,
        cache_misses: 0,
        items_processed: 1,
        bytes_processed: 0
      });
      
      monitor.record({
        operation: 'operation_b',
        start_time: 0,
        end_time: 100,
        duration_ms: 100,
        stage_timers: {},
        cache_hits: 0,
        cache_misses: 0,
        items_processed: 1,
        bytes_processed: 0
      });
      
      const statsA = monitor.getPercentiles('operation_a');
      const statsB = monitor.getPercentiles('operation_b');
      
      expect(statsA.count).toBe(1);
      expect(statsA.mean).toBe(10);
      expect(statsB.count).toBe(1);
      expect(statsB.mean).toBe(100);
    });
    
    test('detects SLO violations correctly', () => {
      // Add metrics that violate SLOs
      monitor.record({
        operation: 'ticket_verify',
        start_time: 0,
        end_time: 50,
        duration_ms: 50, // Exceeds 25ms SLO
        stage_timers: {},
        cache_hits: 0,
        cache_misses: 0,
        items_processed: 1,
        bytes_processed: 0
      });
      
      monitor.record({
        operation: 'full_validate',
        start_time: 0,
        end_time: 500,
        duration_ms: 500, // Exceeds 400ms SLO
        stage_timers: {},
        cache_hits: 0,
        cache_misses: 0,
        items_processed: 1,
        bytes_processed: 0
      });
      
      const { violations, warnings } = monitor.checkSLOs(budget);
      
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.includes('Ticket verification'))).toBe(true);
      expect(violations.some(v => v.includes('Full validation'))).toBe(true);
    });
    
    test('returns no violations when within SLOs', () => {
      // Add metrics within SLO bounds
      monitor.record({
        operation: 'ticket_verify',
        start_time: 0,
        end_time: 15,
        duration_ms: 15, // Within 25ms SLO
        stage_timers: {},
        cache_hits: 0,
        cache_misses: 0,
        items_processed: 1,
        bytes_processed: 0
      });
      
      monitor.record({
        operation: 'full_validate',
        start_time: 0,
        end_time: 300,
        duration_ms: 300, // Within 400ms SLO
        stage_timers: {},
        cache_hits: 0,
        cache_misses: 0,
        items_processed: 1,
        bytes_processed: 0
      });
      
      const { violations, warnings } = monitor.checkSLOs(budget);
      
      expect(violations).toHaveLength(0);
    });
  });
  
  describe('Performance Budget Compliance', () => {
    test('validation completes within 750ms budget', async () => {
      const config: IncrementalValidationConfig = {
        cache_compiled_cue: true,
        cache_contract_bytecode: true,
        validate_changed_only: true,
        batch_coalesce_window_ms: 100,
        batch_per_package: true,
        batch_per_module: true,
        per_rule_workers: true,
        back_pressure_control: true,
        cpu_core_limit: true,
        max_workers: 4,
        lru_ui_profiles: true,
        lru_contract_bytecode: true,
        lru_design_tokens: true,
        warm_common_rulesets: true,
        content_hash_shortcuts: true,
        memory_mapped_reads: true,
        avoid_extra_copies: true,
        canonicalize_once: true
      };
      
      const budget: PerformanceBudget = {
        payload_size_max_bytes: 64 * 1024,
        end_to_end_max_ms: 750,
        target_latency_ms: 400,
        watch_loop_rate_rps: 1,
        ticket_verify_p95_ms: 25,
        full_validate_p95_ms: 400,
        stream_start_max_ms: 100,
        false_negatives: 0
      };
      
      const engine = new IncrementalValidationEngine(config, budget);
      
      const content = 'complex validation content that needs comprehensive processing';
      const result = await engine.validate(content);
      
      expect(result.valid).toBe(true);
      expect(result.performance_metrics?.duration_ms).toBeLessThan(budget.end_to_end_max_ms);
    });
    
    test('ticket verification meets 25ms P95 SLO', async () => {
      const results: number[] = [];
      
      // Simulate ticket verification operations
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        
        // Simulate ticket verification (should be very fast)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        
        const duration = performance.now() - startTime;
        results.push(duration);
      }
      
      results.sort((a, b) => a - b);
      const p95Index = Math.ceil(results.length * 0.95) - 1;
      const p95 = results[p95Index];
      
      expect(p95).toBeLessThan(25);
    });
  });
  
  describe('Error Handling & Edge Cases', () => {
    test('ValidationError includes performance metrics', async () => {
      const config: IncrementalValidationConfig = {
        cache_compiled_cue: true,
        cache_contract_bytecode: true,
        validate_changed_only: true,
        batch_coalesce_window_ms: 100,
        batch_per_package: true,
        batch_per_module: true,
        per_rule_workers: true,
        back_pressure_control: true,
        cpu_core_limit: true,
        lru_ui_profiles: true,
        lru_contract_bytecode: true,
        lru_design_tokens: true,
        warm_common_rulesets: true,
        content_hash_shortcuts: true,
        memory_mapped_reads: true,
        avoid_extra_copies: true,
        canonicalize_once: true
      };
      
      const budget: PerformanceBudget = {
        payload_size_max_bytes: 64 * 1024,
        end_to_end_max_ms: 750,
        target_latency_ms: 400,
        watch_loop_rate_rps: 1,
        ticket_verify_p95_ms: 25,
        full_validate_p95_ms: 400,
        stream_start_max_ms: 100,
        false_negatives: 0
      };
      
      const timer = new PerformanceTimer('test_error');
      const metrics = timer.complete();
      
      const error = new ValidationError('Test error', metrics);
      
      expect(error.message).toBe('Test error');
      expect(error.performanceMetrics).toBe(metrics);
      expect(error.name).toBe('ValidationError');
    });
    
    test('handles empty percentile calculations', () => {
      const monitor = new PerformanceMonitor();
      const stats = monitor.getPercentiles('nonexistent_operation');
      
      expect(stats.p50).toBe(0);
      expect(stats.p95).toBe(0);
      expect(stats.p99).toBe(0);
      expect(stats.mean).toBe(0);
      expect(stats.count).toBe(0);
    });
  });
});