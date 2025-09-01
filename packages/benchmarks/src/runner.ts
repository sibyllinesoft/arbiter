#!/usr/bin/env bun

import { performance } from 'perf_hooks';
import { apiBenchmark } from './api-bench';
import { websocketBenchmark } from './websocket-bench';
import { cueBenchmark } from './cue-bench';
import { memoryBenchmark } from './memory-bench';
import { bundleBenchmark } from './bundle-bench';
import { QualityGates } from './quality-gates';
import { BenchmarkReporter } from './reporter';
import type { BenchmarkSuite, BenchmarkConfig } from './types';

export class BenchmarkRunner {
  private config: BenchmarkConfig;
  private gates: QualityGates;
  private reporter: BenchmarkReporter;

  constructor(config: BenchmarkConfig) {
    this.config = config;
    this.gates = new QualityGates();
    this.reporter = new BenchmarkReporter();
  }

  async runAll(): Promise<BenchmarkSuite> {
    const startTime = performance.now();
    const results = [];

    console.log('🚀 Starting Arbiter Performance & Security Benchmark Suite');
    console.log('====================================================');

    // System info
    const environment = {
      node_version: process.version,
      bun_version: Bun.version,
      os: `${process.platform} ${process.arch}`,
      arch: process.arch,
      memory: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      cpu_count: navigator.hardwareConcurrency || 1,
    };

    console.log('📊 Environment:', environment);

    // Load baseline if exists
    const baseline = await this.loadBaseline();
    if (baseline) {
      console.log('📈 Loaded performance baseline from:', baseline.timestamp);
    }

    try {
      // API Performance Benchmarks
      console.log('\n🌐 Running API Performance Benchmarks...');
      const apiResult = await apiBenchmark(this.config.api);
      results.push(apiResult);

      // WebSocket Performance Benchmarks  
      console.log('\n🔌 Running WebSocket Performance Benchmarks...');
      const wsResult = await websocketBenchmark(this.config.websocket);
      results.push(wsResult);

      // CUE Analysis Performance Benchmarks
      console.log('\n⚙️ Running CUE Analysis Performance Benchmarks...');
      const cueResult = await cueBenchmark(this.config.cue);
      results.push(cueResult);

      // Memory Usage Benchmarks
      console.log('\n🧠 Running Memory Usage Benchmarks...');
      const memoryResult = await memoryBenchmark(this.config.memory);
      results.push(memoryResult);

      // Bundle Size Benchmarks
      console.log('\n📦 Running Bundle Size Benchmarks...');
      const bundleResult = await bundleBenchmark();
      results.push(bundleResult);

    } catch (error) {
      console.error('❌ Benchmark execution failed:', error);
      throw error;
    }

    const totalDuration = performance.now() - startTime;

    // Evaluate quality gates
    console.log('\n🚧 Evaluating Quality Gates...');
    const gateResults = await this.gates.evaluate(results, baseline);
    
    const suite: BenchmarkSuite = {
      version: '0.1.0',
      environment,
      baseline,
      results,
      summary: {
        total_duration: totalDuration,
        passed_gates: gateResults.passed.length,
        failed_gates: gateResults.failed.length,
        performance_regression: gateResults.hasRegression,
        security_issues: gateResults.securityIssues,
      },
    };

    // Generate reports
    console.log('\n📊 Generating Reports...');
    await this.reporter.generate(suite, gateResults);

    // Print summary
    this.printSummary(suite, gateResults);

    return suite;
  }

  private async loadBaseline() {
    try {
      const baselineFile = await Bun.file('./benchmarks/baseline.json');
      if (await baselineFile.exists()) {
        return await baselineFile.json();
      }
    } catch (error) {
      console.log('📊 No baseline found, will create new one');
    }
    return null;
  }

  private printSummary(suite: BenchmarkSuite, gateResults: any) {
    console.log('\n📋 BENCHMARK SUMMARY');
    console.log('===================');
    console.log(`⏱️  Total Duration: ${Math.round(suite.summary.total_duration)}ms`);
    console.log(`✅ Passed Gates: ${suite.summary.passed_gates}`);
    console.log(`❌ Failed Gates: ${suite.summary.failed_gates}`);
    console.log(`🔄 Performance Regression: ${suite.summary.performance_regression ? 'YES' : 'NO'}`);
    console.log(`🔒 Security Issues: ${suite.summary.security_issues}`);

    if (gateResults.failed.length > 0) {
      console.log('\\n⚠️  FAILED GATES:');
      gateResults.failed.forEach((gate: any) => {
        console.log(`  - ${gate.name}: ${gate.reason}`);
      });
    }

    if (suite.summary.failed_gates > 0 || suite.summary.security_issues > 0) {
      console.log('\\n❌ QUALITY GATES FAILED - Build should be blocked');
      process.exit(1);
    } else {
      console.log('\\n✅ ALL QUALITY GATES PASSED - Build can proceed');
    }
  }
}

// CLI entry point
if (import.meta.main) {
  const config: BenchmarkConfig = {
    api: {
      baseUrl: process.env.API_URL || 'http://localhost:3001',
      concurrency: 10,
      duration: 10, // seconds
      endpoints: ['/projects', '/analyze'],
    },
    websocket: {
      url: process.env.WS_URL || 'ws://localhost:3001',
      connections: 50,
      messagesPerConnection: 100,
      messageSize: 1024,
    },
    cue: {
      sampleFiles: ['./examples/basic.cue', './examples/complex.cue'],
      iterations: 100,
      timeout: 750,
    },
    memory: {
      iterations: 1000,
      gcForce: true,
    },
  };

  const runner = new BenchmarkRunner(config);
  
  try {
    await runner.runAll();
  } catch (error) {
    console.error('💥 Benchmark suite failed:', error);
    process.exit(1);
  }
}