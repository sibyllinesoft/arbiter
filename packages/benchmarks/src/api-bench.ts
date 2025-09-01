import autocannon from 'autocannon';
import type { BenchmarkResult } from './types';

export interface ApiBenchmarkConfig {
  baseUrl: string;
  concurrency: number;
  duration: number;
  endpoints: string[];
}

export async function apiBenchmark(config: ApiBenchmarkConfig): Promise<BenchmarkResult> {
  const startTime = Date.now();
  const results: any[] = [];

  console.log(`🌐 Testing API endpoints with ${config.concurrency} concurrent connections for ${config.duration}s`);

  // Test each endpoint
  for (const endpoint of config.endpoints) {
    const url = `${config.baseUrl}${endpoint}`;
    console.log(`  📡 Testing ${endpoint}...`);

    try {
      const result = await autocannon({
        url,
        connections: config.concurrency,
        duration: config.duration,
        method: endpoint === '/analyze' ? 'POST' : 'GET',
        body: endpoint === '/analyze' ? JSON.stringify({
          text: 'package test\\nname: "benchmark"\\nversion: "1.0.0"'
        }) : undefined,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      results.push({
        endpoint,
        latency: {
          mean: result.latency.mean,
          p50: result.latency.p50,
          p75: result.latency.p75,
          p90: result.latency.p90,
          p95: result.latency.p95,
          p99: result.latency.p99,
          max: result.latency.max,
        },
        throughput: {
          mean: result.throughput.mean,
          total: result.requests.total,
          rps: result.requests.average,
        },
        errors: result.errors,
      });

      console.log(`    ⚡ RPS: ${result.requests.average}, p95: ${result.latency.p95}ms`);
    } catch (error) {
      console.error(`    ❌ Failed to benchmark ${endpoint}:`, error);
      results.push({
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Calculate aggregate metrics
  const totalRequests = results.reduce((sum, r) => sum + (r.throughput?.total || 0), 0);
  const avgLatency = results.reduce((sum, r) => sum + (r.latency?.mean || 0), 0) / results.length;
  const p95Latency = Math.max(...results.map(r => r.latency?.p95 || 0));
  const totalRPS = results.reduce((sum, r) => sum + (r.throughput?.rps || 0), 0);

  return {
    name: 'API Performance Benchmark',
    type: 'api',
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    metrics: {
      total_requests: totalRequests,
      avg_latency_ms: Math.round(avgLatency * 100) / 100,
      p95_latency_ms: p95Latency,
      total_rps: Math.round(totalRPS * 100) / 100,
      error_count: results.reduce((sum, r) => sum + (r.errors || 0), 0),
      endpoints_tested: config.endpoints.length,
    },
    metadata: {
      config,
      results,
    },
  };
}