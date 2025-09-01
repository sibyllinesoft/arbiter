import { spawn } from 'bun';
import { performance } from 'perf_hooks';
import { Bench } from 'tinybench';
import type { BenchmarkResult } from './types';

export interface CueBenchmarkConfig {
  sampleFiles: string[];
  iterations: number;
  timeout: number;
}

export async function cueBenchmark(config: CueBenchmarkConfig): Promise<BenchmarkResult> {
  const startTime = Date.now();
  const results = {
    evaluations: 0,
    successes: 0,
    failures: 0,
    timeouts: 0,
    execution_times: [] as number[],
    memory_usage: [] as number[],
  };

  console.log(`⚙️ Testing CUE analysis performance with ${config.iterations} iterations`);

  // Create benchmark suite
  const bench = new Bench({ time: 100 });

  // Test different CUE configurations
  const testCases = [
    {
      name: 'Simple Configuration',
      content: `
package test
name: "simple"
version: "1.0.0"
config: {
  port: 8080
  debug: true
}
`,
    },
    {
      name: 'Complex Configuration',
      content: `
package complex
#Config: {
  name: string
  version: =~"^\\\\d+\\\\.\\\\d+\\\\.\\\\d+$"
  services: [...#Service]
}

#Service: {
  name: string
  port: int & >0 & <65536
  replicas: *1 | int & >0 & <=10
  resources: {
    cpu: string
    memory: string
  }
}

config: #Config & {
  name: "complex-app"
  version: "1.2.3"
  services: [
    {
      name: "api"
      port: 8080
      replicas: 3
      resources: {
        cpu: "500m"
        memory: "1Gi"
      }
    },
    {
      name: "worker" 
      port: 8081
      replicas: 2
      resources: {
        cpu: "250m"
        memory: "512Mi"
      }
    }
  ]
}
`,
    },
    {
      name: 'Large Configuration',
      content: generateLargeConfig(),
    },
  ];

  // Add benchmarks for each test case
  for (const testCase of testCases) {
    bench.add(testCase.name, async () => {
      const evalStart = performance.now();
      const memBefore = process.memoryUsage();

      try {
        await evaluateCue(testCase.content, config.timeout);
        
        const duration = performance.now() - evalStart;
        const memAfter = process.memoryUsage();
        const memDelta = memAfter.heapUsed - memBefore.heapUsed;

        results.execution_times.push(duration);
        results.memory_usage.push(memDelta);
        results.evaluations++;
        results.successes++;

      } catch (error) {
        const duration = performance.now() - evalStart;
        results.execution_times.push(duration);
        results.evaluations++;
        
        if (error instanceof Error && error.message.includes('timeout')) {
          results.timeouts++;
        } else {
          results.failures++;
        }
      }
    });
  }

  // Run benchmarks
  await bench.run();

  // Calculate statistics
  const avgExecutionTime = results.execution_times.reduce((a, b) => a + b, 0) / results.execution_times.length || 0;
  const p95ExecutionTime = results.execution_times.sort((a, b) => a - b)[Math.floor(results.execution_times.length * 0.95)] || 0;
  const avgMemoryDelta = results.memory_usage.reduce((a, b) => a + b, 0) / results.memory_usage.length || 0;
  const successRate = (results.successes / results.evaluations) * 100;
  
  const totalDuration = Date.now() - startTime;
  const evaluationsPerSecond = (results.evaluations / totalDuration) * 1000;

  console.log(`  ⚡ Completed ${results.evaluations} evaluations`);
  console.log(`  ✅ Success rate: ${Math.round(successRate)}%`);
  console.log(`  ⏱️  Avg execution time: ${Math.round(avgExecutionTime)}ms`);
  console.log(`  🧠 Avg memory delta: ${Math.round(avgMemoryDelta / 1024)}KB`);

  // Print benchmark results
  console.log('\\n📊 CUE Benchmark Results:');
  bench.tasks.forEach(task => {
    console.log(`  ${task.name}: ${Math.round(task.result?.mean || 0)}ms ±${Math.round((task.result?.rme || 0) * 100) / 100}%`);
  });

  return {
    name: 'CUE Analysis Performance Benchmark',
    type: 'cue',
    timestamp: new Date().toISOString(),
    duration: totalDuration,
    metrics: {
      total_evaluations: results.evaluations,
      successful_evaluations: results.successes,
      failed_evaluations: results.failures,
      timeout_evaluations: results.timeouts,
      success_rate_percent: Math.round(successRate * 100) / 100,
      avg_execution_time_ms: Math.round(avgExecutionTime * 100) / 100,
      p95_execution_time_ms: Math.round(p95ExecutionTime * 100) / 100,
      evaluations_per_second: Math.round(evaluationsPerSecond * 100) / 100,
      avg_memory_delta_kb: Math.round(avgMemoryDelta / 1024 * 100) / 100,
      benchmark_ops_per_sec: Math.round(bench.tasks.reduce((sum, task) => sum + (task.result?.hz || 0), 0) / bench.tasks.length),
    },
    metadata: {
      config,
      benchmark_results: bench.tasks.map(task => ({
        name: task.name,
        ops_per_sec: task.result?.hz,
        mean_time: task.result?.mean,
        margin_of_error: task.result?.rme,
      })),
    },
  };
}

async function evaluateCue(content: string, timeoutMs: number): Promise<void> {
  // Create temporary file
  const tempFile = `/tmp/cue-bench-${Date.now()}-${Math.random().toString(36).substring(7)}.cue`;
  
  try {
    await Bun.write(tempFile, content);

    // Execute CUE evaluation with timeout
    const proc = spawn(['cue', 'eval', tempFile], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        proc.kill();
        reject(new Error('CUE evaluation timeout'));
      }, timeoutMs);
    });

    await Promise.race([proc.exited, timeoutPromise]);

    if (proc.exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`CUE evaluation failed: ${stderr}`);
    }

  } finally {
    // Cleanup temp file
    try {
      await Bun.$`rm -f ${tempFile}`;
    } catch {
      // Ignore cleanup errors
    }
  }
}

function generateLargeConfig(): string {
  let config = `
package large
#Service: {
  name: string
  port: int & >0 & <65536
  replicas: *1 | int & >0 & <=10
}

config: {
  name: "large-config"
  version: "1.0.0"
  services: [
`;

  // Generate 50 services to create a larger configuration
  for (let i = 1; i <= 50; i++) {
    config += `
    {
      name: "service-${i}"
      port: ${8000 + i}
      replicas: ${Math.ceil(i / 10)}
    },`;
  }

  config += `
  ]
  environment: {`;

  // Add many environment variables
  for (let i = 1; i <= 100; i++) {
    config += `
    "VAR_${i}": "value-${i}"`;
    if (i < 100) config += ',';
  }

  config += `
  }
}
`;

  return config;
}