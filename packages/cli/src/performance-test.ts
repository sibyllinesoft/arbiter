#!/usr/bin/env bun

/**
 * Performance test script for CLI commands
 * Verifies that the CLI meets performance targets
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { CLIBenchmark, PERFORMANCE_TARGETS } from './utils/performance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLI_PATH = path.join(__dirname, 'cli.ts');
const TEST_DATA_DIR = path.join(__dirname, '__tests__', 'perf-data');

/**
 * Generate test CUE files of various sizes
 */
async function generateTestFiles(): Promise<void> {
  await fs.ensureDir(TEST_DATA_DIR);

  // 1KB file
  const small = generateCueContent(1024);
  await fs.writeFile(path.join(TEST_DATA_DIR, '1kb.cue'), small);

  // 10KB file (our target size)
  const medium = generateCueContent(10 * 1024);
  await fs.writeFile(path.join(TEST_DATA_DIR, '10kb.cue'), medium);

  // 100KB file
  const large = generateCueContent(100 * 1024);
  await fs.writeFile(path.join(TEST_DATA_DIR, '100kb.cue'), large);

  console.log('Generated test files:');
  console.log(`  1KB:  ${path.join(TEST_DATA_DIR, '1kb.cue')}`);
  console.log(`  10KB: ${path.join(TEST_DATA_DIR, '10kb.cue')}`);
  console.log(`  100KB: ${path.join(TEST_DATA_DIR, '100kb.cue')}`);
}

/**
 * Generate CUE content of specified size
 */
function generateCueContent(targetSize: number): string {
  const baseContent = `
package test

#Config: {
  name: string
  version: string
  env: "dev" | "staging" | "prod"
  database: #Database
  features: [...#Feature]
}

#Database: {
  host: string
  port: int & >0 & <65536
  name: string
  ssl: bool | *false
}

#Feature: {
  name: string
  enabled: bool | *true
  config: {...}
}

// Generated data
config: #Config & {
  name: "performance-test"
  version: "1.0.0"
  env: "dev"
  database: {
    host: "localhost"
    port: 5432
    name: "test_db"
    ssl: true
  }
  features: [
`;

  let content = baseContent;
  let currentSize = content.length;

  // Add features until we reach target size
  let featureIndex = 0;
  while (currentSize < targetSize - 200) {
    // Leave room for closing
    const feature = `    {
      name: "feature_${featureIndex}"
      enabled: true
      config: {
        setting1: "value_${featureIndex}_setting1"
        setting2: "value_${featureIndex}_setting2"
        setting3: ${Math.random() > 0.5 ? 'true' : 'false'}
        numbers: [${Array.from({ length: 5 }, () => Math.floor(Math.random() * 1000)).join(', ')}]
        metadata: {
          description: "This is a test feature number ${featureIndex} with some additional text to increase file size"
          tags: ["test", "performance", "feature_${featureIndex}"]
          priority: ${Math.floor(Math.random() * 10)}
        }
      }
    },
`;

    content += feature;
    currentSize = content.length;
    featureIndex++;
  }

  content += `  ]
}
`;

  return content;
}

/**
 * Run CLI command and measure performance
 */
async function runCliCommand(
  args: string[],
  cwd?: string
): Promise<{ duration: number; exitCode: number; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    const startTime = performance.now();

    const child = spawn('bun', ['run', CLI_PATH, ...args], {
      cwd: cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NO_COLOR: '1',
        NODE_ENV: 'test',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', data => {
      stdout += data.toString();
    });

    child.stderr?.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      const duration = performance.now() - startTime;
      resolve({
        duration,
        exitCode: code || 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on('error', error => {
      const duration = performance.now() - startTime;
      resolve({
        duration,
        exitCode: 1,
        stdout: '',
        stderr: error.message,
      });
    });

    // 30 second timeout
    setTimeout(() => {
      child.kill();
      const duration = performance.now() - startTime;
      resolve({
        duration,
        exitCode: 124,
        stdout,
        stderr: `${stderr}\nTimeout: Command took too long`,
      });
    }, 30000);
  });
}

/**
 * Benchmark check command performance
 */
async function benchmarkCheckCommand(benchmark: CLIBenchmark): Promise<void> {
  console.log('\nBenchmarking check command...');

  const testFiles = ['1kb.cue', '10kb.cue', '100kb.cue'];
  const iterations = 5;

  for (const testFile of testFiles) {
    await benchmarkSingleFile(testFile, iterations, benchmark);
  }
}

/**
 * Benchmark a single test file
 */
async function benchmarkSingleFile(
  testFile: string,
  iterations: number,
  benchmark: CLIBenchmark
): Promise<void> {
  console.log(`\nTesting ${testFile}:`);

  const durations = await runBenchmarkIterations(testFile, iterations, benchmark);
  const stats = calculateBenchmarkStats(durations);

  reportBenchmarkResults(stats);

  if (testFile === '10kb.cue') {
    validatePerformanceTarget(stats.p95);
  }
}

/**
 * Run multiple benchmark iterations for a file
 */
async function runBenchmarkIterations(
  testFile: string,
  iterations: number,
  benchmark: CLIBenchmark
): Promise<number[]> {
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const result = await runCliCommand(['check', testFile, '--no-color'], TEST_DATA_DIR);

    durations.push(result.duration);
    benchmark.addResult('check', [testFile], result.duration, result.exitCode);

    console.log(`  Run ${i + 1}: ${result.duration.toFixed(1)}ms (exit: ${result.exitCode})`);

    if (result.exitCode !== 0 && result.exitCode !== 1) {
      console.error(`  Error: ${result.stderr}`);
    }
  }

  return durations;
}

/**
 * Calculate benchmark statistics
 */
function calculateBenchmarkStats(durations: number[]): { avg: number; p95: number } {
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const avg = durations.reduce((a, b) => a + b) / durations.length;
  const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)];

  return { avg, p95 };
}

/**
 * Report benchmark results
 */
function reportBenchmarkResults(stats: { avg: number; p95: number }): void {
  console.log(`  Average: ${stats.avg.toFixed(1)}ms`);
  console.log(`  P95: ${stats.p95.toFixed(1)}ms`);
}

/**
 * Validate performance against target
 */
function validatePerformanceTarget(p95: number): void {
  const target = PERFORMANCE_TARGETS.CHECK_10KB_P95;
  if (p95 <= target) {
    console.log(`  ✓ P95 meets target (${target}ms)`);
  } else {
    console.log(`  ✗ P95 exceeds target (${target}ms) by ${(p95 - target).toFixed(1)}ms`);
  }
}

/**
 * Benchmark other commands
 */
async function benchmarkOtherCommands(benchmark: CLIBenchmark): Promise<void> {
  console.log('\nBenchmarking other commands...');

  const commands = [
    { name: 'help', args: ['--help'] },
    { name: 'health', args: ['health'] },
    { name: 'init-templates', args: ['init', '--list-templates'] },
    { name: 'export-formats', args: ['export', 'dummy', '--list-formats'] },
  ];

  for (const cmd of commands) {
    console.log(`\nTesting ${cmd.name}:`);

    const result = await runCliCommand(cmd.args);

    benchmark.addResult(cmd.name, cmd.args, result.duration, result.exitCode);

    console.log(`  Duration: ${result.duration.toFixed(1)}ms (exit: ${result.exitCode})`);

    if (result.exitCode !== 0) {
      console.error(`  Error: ${result.stderr}`);
    }
  }
}

/**
 * Main performance test function
 */
async function main(): Promise<void> {
  console.log('Arbiter CLI Performance Test');
  console.log('============================');

  try {
    // Generate test files
    console.log('Generating test files...');
    await generateTestFiles();

    // Initialize benchmark tracker
    const benchmark = new CLIBenchmark();

    // Run benchmarks
    await benchmarkCheckCommand(benchmark);
    await benchmarkOtherCommands(benchmark);

    // Print final report
    benchmark.printReport();

    // Check if performance targets were met
    const checkStats = benchmark.getStats('check');
    if (checkStats) {
      const target = PERFORMANCE_TARGETS.CHECK_10KB_P95;
      if (checkStats.p95Duration <= target) {
        console.log('\n✓ All performance targets met!');
        process.exit(0);
      } else {
        console.log('\n✗ Performance targets not met');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Performance test failed:', error);
    process.exit(2);
  } finally {
    // Clean up test files
    await fs.remove(TEST_DATA_DIR);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
