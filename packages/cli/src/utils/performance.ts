import { performance } from "node:perf_hooks";
import chalk from "chalk";

/**
 * Performance measurement utility for CLI operations
 */
export class PerformanceTracker {
  private measurements = new Map<string, number>();
  private marks = new Map<string, number>();

  /**
   * Start measuring an operation
   */
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  /**
   * End measuring an operation and store the duration
   */
  measure(name: string, startMark?: string): number {
    const endTime = performance.now();
    const startTime = startMark ? this.marks.get(startMark) || 0 : this.marks.get(name) || 0;
    const duration = endTime - startTime;

    this.measurements.set(name, duration);
    return duration;
  }

  /**
   * Get measurement duration
   */
  getDuration(name: string): number | undefined {
    return this.measurements.get(name);
  }

  /**
   * Get all measurements
   */
  getAllMeasurements(): Record<string, number> {
    return Object.fromEntries(this.measurements);
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
    this.marks.clear();
  }

  /**
   * Print performance report
   */
  printReport(title: string = "Performance Report"): void {
    console.log(chalk.cyan(`\n${title}:`));

    const sorted = Array.from(this.measurements.entries()).sort(([, a], [, b]) => b - a);

    for (const [name, duration] of sorted) {
      const color = duration < 100 ? "green" : duration < 500 ? "yellow" : "red";
      console.log(`  ${chalk[color](formatDuration(duration).padStart(8))} ${name}`);
    }

    const total = Array.from(this.measurements.values()).reduce((a, b) => a + b, 0);
    console.log(`  ${chalk.bold(formatDuration(total).padStart(8))} Total`);
  }
}

/**
 * Format duration with appropriate units
 */
export function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}μs`;
  } else if (ms < 1000) {
    return `${ms.toFixed(1)}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

/**
 * Measure async function execution time
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  tracker?: PerformanceTracker,
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;

    if (tracker) {
      tracker.measurements.set(name, duration);
    }

    return { result, duration };
  } catch (error) {
    const duration = performance.now() - start;

    if (tracker) {
      tracker.measurements.set(`${name} (failed)`, duration);
    }

    throw error;
  }
}

/**
 * Measure sync function execution time
 */
export function measureSync<T>(
  name: string,
  fn: () => T,
  tracker?: PerformanceTracker,
): { result: T; duration: number } {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;

    if (tracker) {
      tracker.measurements.set(name, duration);
    }

    return { result, duration };
  } catch (error) {
    const duration = performance.now() - start;

    if (tracker) {
      tracker.measurements.set(`${name} (failed)`, duration);
    }

    throw error;
  }
}

/**
 * Performance optimization configurations
 */
export const PERFORMANCE_TARGETS = {
  /** Target for check command on 10KB documents (P95) */
  CHECK_10KB_P95: 1000, // 1 second

  /** Target for API response time */
  API_RESPONSE: 200, // 200ms

  /** Target for file I/O operations */
  FILE_IO: 50, // 50ms

  /** Target for validation per file */
  VALIDATION_PER_FILE: 100, // 100ms

  /** Maximum concurrent validations */
  MAX_CONCURRENCY: 5,
};

/**
 * Check if performance targets are met
 */
export function checkPerformanceTargets(
  measurements: Record<string, number>,
  targets: Record<string, number> = PERFORMANCE_TARGETS,
): {
  passed: boolean;
  violations: Array<{ name: string; actual: number; target: number }>;
} {
  const violations: Array<{ name: string; actual: number; target: number }> = [];

  for (const [name, target] of Object.entries(targets)) {
    const actual = measurements[name];
    if (actual !== undefined && actual > target) {
      violations.push({ name, actual, target });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Global performance tracker instance
 */
export const globalTracker = new PerformanceTracker();

/**
 * Decorator for measuring method performance
 */
export function measured(name?: string) {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    const measurementName = name || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const { result, duration } = await measureAsync(
        measurementName,
        () => method.apply(this, args),
        globalTracker,
      );
      return result;
    };
  };
}

/**
 * Performance benchmark for CLI commands
 */
export class CLIBenchmark {
  private results: Array<{
    command: string;
    args: string[];
    duration: number;
    exitCode: number;
  }> = [];

  /**
   * Add benchmark result
   */
  addResult(command: string, args: string[], duration: number, exitCode: number): void {
    this.results.push({ command, args, duration, exitCode });
  }

  /**
   * Get statistics for a command
   */
  getStats(command: string): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    p95Duration: number;
    successRate: number;
  } | null {
    const commandResults = this.results.filter((r) => r.command === command);

    if (commandResults.length === 0) {
      return null;
    }

    const durations = commandResults.map((r) => r.duration).sort((a, b) => a - b);
    const successCount = commandResults.filter((r) => r.exitCode === 0).length;

    return {
      count: commandResults.length,
      avgDuration: durations.reduce((a, b) => a + b) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      successRate: successCount / commandResults.length,
    };
  }

  /**
   * Print benchmark report
   */
  printReport(): void {
    const commands = [...new Set(this.results.map((r) => r.command))];

    console.log(chalk.cyan("\nCLI Performance Benchmark:"));
    console.log("".padEnd(60, "-"));

    for (const command of commands) {
      const stats = this.getStats(command);
      if (!stats) continue;

      console.log(`${chalk.bold(command)}:`);
      console.log(`  Count:       ${stats.count}`);
      console.log(`  Success:     ${(stats.successRate * 100).toFixed(1)}%`);
      console.log(`  Avg:         ${formatDuration(stats.avgDuration)}`);
      console.log(`  Min:         ${formatDuration(stats.minDuration)}`);
      console.log(`  Max:         ${formatDuration(stats.maxDuration)}`);
      console.log(`  P95:         ${formatDuration(stats.p95Duration)}`);

      // Check against targets
      const target = PERFORMANCE_TARGETS.CHECK_10KB_P95;
      if (command === "check" && stats.p95Duration > target) {
        console.log(`  ${chalk.red("⚠ P95 exceeds target")} (${formatDuration(target)})`);
      } else if (command === "check") {
        console.log(`  ${chalk.green("✓ P95 meets target")} (${formatDuration(target)})`);
      }

      console.log();
    }
  }
}
