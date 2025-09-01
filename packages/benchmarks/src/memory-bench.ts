import { performance } from 'perf_hooks';
import type { BenchmarkResult } from './types';

export interface MemoryBenchmarkConfig {
  iterations: number;
  gcForce: boolean;
}

export async function memoryBenchmark(config: MemoryBenchmarkConfig): Promise<BenchmarkResult> {
  const startTime = Date.now();
  
  console.log(`🧠 Testing memory usage patterns with ${config.iterations} iterations`);
  
  const results = {
    heap_snapshots: [] as Array<{
      timestamp: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    }>,
    gc_runs: 0,
    memory_leaks: [] as Array<{
      operation: string;
      before: number;
      after: number;
      delta: number;
    }>,
  };

  // Baseline memory snapshot
  if (config.gcForce && global.gc) {
    global.gc();
    results.gc_runs++;
  }
  
  const baseline = process.memoryUsage();
  results.heap_snapshots.push({
    timestamp: performance.now(),
    heapUsed: baseline.heapUsed,
    heapTotal: baseline.heapTotal,
    external: baseline.external,
    rss: baseline.rss,
  });

  console.log(`  📊 Baseline memory: ${Math.round(baseline.heapUsed / 1024 / 1024)}MB heap`);

  // Test various memory-intensive operations
  const operations = [
    {
      name: 'Large Object Creation',
      fn: () => simulateLargeObjectCreation(),
    },
    {
      name: 'Array Processing', 
      fn: () => simulateArrayProcessing(),
    },
    {
      name: 'String Manipulation',
      fn: () => simulateStringManipulation(),
    },
    {
      name: 'WebSocket Buffer Simulation',
      fn: () => simulateWebSocketBuffers(),
    },
    {
      name: 'CUE Analysis Simulation',
      fn: () => simulateCueAnalysis(),
    },
  ];

  for (const operation of operations) {
    console.log(`  🔄 Testing ${operation.name}...`);
    
    // Pre-operation memory
    if (config.gcForce && global.gc) {
      global.gc();
      results.gc_runs++;
    }
    
    const memBefore = process.memoryUsage();
    
    // Run operation multiple times
    for (let i = 0; i < config.iterations; i++) {
      await operation.fn();
      
      if (i % 100 === 0) {
        // Periodic memory snapshot
        const mem = process.memoryUsage();
        results.heap_snapshots.push({
          timestamp: performance.now(),
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
          external: mem.external,
          rss: mem.rss,
        });
      }
    }
    
    // Post-operation memory
    if (config.gcForce && global.gc) {
      global.gc();
      results.gc_runs++;
    }
    
    const memAfter = process.memoryUsage();
    
    const memoryDelta = memAfter.heapUsed - memBefore.heapUsed;
    results.memory_leaks.push({
      operation: operation.name,
      before: memBefore.heapUsed,
      after: memAfter.heapUsed,
      delta: memoryDelta,
    });

    console.log(`    📈 Memory delta: ${Math.round(memoryDelta / 1024)}KB`);
  }

  // Final memory snapshot
  if (config.gcForce && global.gc) {
    global.gc();
    results.gc_runs++;
  }
  
  const final = process.memoryUsage();
  results.heap_snapshots.push({
    timestamp: performance.now(),
    heapUsed: final.heapUsed,
    heapTotal: final.heapTotal,
    external: final.external,
    rss: final.rss,
  });

  // Calculate statistics
  const totalMemoryDelta = final.heapUsed - baseline.heapUsed;
  const maxHeapUsage = Math.max(...results.heap_snapshots.map(s => s.heapUsed));
  const avgHeapUsage = results.heap_snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / results.heap_snapshots.length;
  
  // Detect potential memory leaks (>10MB growth after GC)
  const potentialLeaks = results.memory_leaks.filter(leak => leak.delta > 10 * 1024 * 1024).length;
  
  const totalDuration = Date.now() - startTime;

  console.log(`  📊 Total memory delta: ${Math.round(totalMemoryDelta / 1024)}KB`);
  console.log(`  🔝 Peak heap usage: ${Math.round(maxHeapUsage / 1024 / 1024)}MB`);
  console.log(`  ⚠️  Potential leaks detected: ${potentialLeaks}`);

  return {
    name: 'Memory Usage Benchmark',
    type: 'memory',
    timestamp: new Date().toISOString(),
    duration: totalDuration,
    metrics: {
      baseline_heap_mb: Math.round(baseline.heapUsed / 1024 / 1024 * 100) / 100,
      final_heap_mb: Math.round(final.heapUsed / 1024 / 1024 * 100) / 100,
      total_memory_delta_mb: Math.round(totalMemoryDelta / 1024 / 1024 * 100) / 100,
      max_heap_usage_mb: Math.round(maxHeapUsage / 1024 / 1024 * 100) / 100,
      avg_heap_usage_mb: Math.round(avgHeapUsage / 1024 / 1024 * 100) / 100,
      gc_runs: results.gc_runs,
      potential_leaks: potentialLeaks,
      memory_efficiency_score: Math.max(0, 100 - (totalMemoryDelta / (config.iterations * 1024))), // Lower growth = higher score
    },
    metadata: {
      config,
      snapshots: results.heap_snapshots,
      leak_analysis: results.memory_leaks,
    },
  };
}

async function simulateLargeObjectCreation() {
  // Simulate creating large configuration objects like CUE analysis results
  const largeObject = {
    id: Math.random().toString(36),
    timestamp: Date.now(),
    data: new Array(1000).fill(0).map((_, i) => ({
      key: `item_${i}`,
      value: Math.random(),
      nested: {
        a: Math.random(),
        b: Math.random(),
        c: new Array(10).fill('x').join(''),
      },
    })),
  };
  
  // Process and discard
  JSON.stringify(largeObject);
}

async function simulateArrayProcessing() {
  // Simulate processing large arrays like WebSocket message queues
  const array = new Array(10000).fill(0).map(() => Math.random());
  
  // Various array operations
  array.filter(x => x > 0.5);
  array.map(x => x * 2);
  array.reduce((sum, x) => sum + x, 0);
  array.sort();
}

async function simulateStringManipulation() {
  // Simulate CUE content processing
  let content = 'package test\\n';
  
  for (let i = 0; i < 1000; i++) {
    content += `field_${i}: "${Math.random()}"\\n`;
  }
  
  // Process the string
  content.split('\\n');
  content.replace(/field_/g, 'item_');
  JSON.parse(`{"data": "${content.replace(/\\n/g, '\\\\n')}"}`);
}

async function simulateWebSocketBuffers() {
  // Simulate WebSocket message buffers
  const buffers = [];
  
  for (let i = 0; i < 100; i++) {
    const buffer = Buffer.from(JSON.stringify({
      type: 'sync',
      data: new Array(1024).fill('x').join(''),
      timestamp: Date.now(),
    }));
    buffers.push(buffer);
  }
  
  // Process buffers
  buffers.forEach(buf => buf.toString());
  buffers.splice(0, buffers.length); // Clear
}

async function simulateCueAnalysis() {
  // Simulate CUE analysis memory patterns
  const analysis = {
    errors: [],
    warnings: [],
    graph: new Array(500).fill(0).map((_, i) => ({
      id: `node_${i}`,
      type: Math.random() > 0.5 ? 'object' : 'value',
      children: Math.random() > 0.7 ? [`child_${i}_1`, `child_${i}_2`] : [],
      metadata: {
        line: Math.floor(Math.random() * 1000),
        column: Math.floor(Math.random() * 80),
      },
    })),
    value: {},
  };
  
  // Serialize and process
  const serialized = JSON.stringify(analysis);
  JSON.parse(serialized);
}