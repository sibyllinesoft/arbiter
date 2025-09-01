import ora, { Ora } from 'ora';
import chalk from 'chalk';
import type { ProgressOptions } from '../types.js';

/**
 * Progress indicator utility class
 */
export class Progress {
  private spinner: Ora;
  private startTime: number;

  constructor(options: ProgressOptions) {
    this.spinner = ora({
      text: options.text,
      color: options.color || 'blue',
      spinner: options.spinner || 'dots',
    });
    this.startTime = Date.now();
  }

  /**
   * Start the progress indicator
   */
  start(): void {
    this.spinner.start();
  }

  /**
   * Update the progress text
   */
  update(text: string): void {
    this.spinner.text = text;
  }

  /**
   * Mark as successful and stop
   */
  succeed(text?: string): void {
    const elapsed = Date.now() - this.startTime;
    const message = text || this.spinner.text;
    this.spinner.succeed(`${message} ${chalk.dim(`(${elapsed}ms)`)}`);
  }

  /**
   * Mark as failed and stop
   */
  fail(text?: string): void {
    const elapsed = Date.now() - this.startTime;
    const message = text || this.spinner.text;
    this.spinner.fail(`${message} ${chalk.dim(`(${elapsed}ms)`)}`);
  }

  /**
   * Mark as warning and stop
   */
  warn(text?: string): void {
    const elapsed = Date.now() - this.startTime;
    const message = text || this.spinner.text;
    this.spinner.warn(`${message} ${chalk.dim(`(${elapsed}ms)`)}`);
  }

  /**
   * Stop without status
   */
  stop(): void {
    this.spinner.stop();
  }

  /**
   * Get elapsed time
   */
  getElapsed(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Create and manage multiple progress indicators
 */
export class MultiProgress {
  private progresses: Map<string, Progress> = new Map();
  
  /**
   * Add a new progress indicator
   */
  add(id: string, options: ProgressOptions): Progress {
    const progress = new Progress(options);
    this.progresses.set(id, progress);
    return progress;
  }

  /**
   * Get a progress indicator by ID
   */
  get(id: string): Progress | undefined {
    return this.progresses.get(id);
  }

  /**
   * Update all progress indicators
   */
  updateAll(text: string): void {
    this.progresses.forEach(progress => {
      progress.update(text);
    });
  }

  /**
   * Stop all progress indicators
   */
  stopAll(): void {
    this.progresses.forEach(progress => {
      progress.stop();
    });
    this.progresses.clear();
  }

  /**
   * Mark all as successful
   */
  succeedAll(text?: string): void {
    this.progresses.forEach(progress => {
      progress.succeed(text);
    });
    this.progresses.clear();
  }

  /**
   * Mark all as failed
   */
  failAll(text?: string): void {
    this.progresses.forEach(progress => {
      progress.fail(text);
    });
    this.progresses.clear();
  }
}

/**
 * Simple progress logger for non-interactive environments
 */
export class SimpleProgress {
  private startTime: number;
  private lastUpdate: number;
  private updateInterval: number;

  constructor(updateInterval: number = 1000) {
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
    this.updateInterval = updateInterval;
  }

  /**
   * Log progress message with timestamp
   */
  log(message: string): void {
    const now = Date.now();
    const elapsed = now - this.startTime;
    const since = now - this.lastUpdate;
    
    if (since >= this.updateInterval) {
      console.log(`[${new Date().toISOString()}] ${message} (+${elapsed}ms)`);
      this.lastUpdate = now;
    }
  }

  /**
   * Log success message
   */
  success(message: string): void {
    const elapsed = Date.now() - this.startTime;
    console.log(chalk.green(`✓ ${message} (${elapsed}ms)`));
  }

  /**
   * Log error message
   */
  error(message: string): void {
    const elapsed = Date.now() - this.startTime;
    console.log(chalk.red(`✗ ${message} (${elapsed}ms)`));
  }

  /**
   * Log warning message
   */
  warn(message: string): void {
    const elapsed = Date.now() - this.startTime;
    console.log(chalk.yellow(`! ${message} (${elapsed}ms)`));
  }
}

/**
 * Create appropriate progress indicator based on environment
 */
export function createProgress(options: ProgressOptions): Progress | SimpleProgress {
  // Use simple progress in CI or non-TTY environments
  if (!process.stdout.isTTY || process.env.CI) {
    return new SimpleProgress();
  }
  
  return new Progress(options);
}

/**
 * Measure and report performance of an operation
 */
export async function withProgress<T>(
  options: ProgressOptions,
  operation: () => Promise<T>
): Promise<T> {
  const progress = createProgress(options);
  
  if (progress instanceof Progress) {
    progress.start();
  } else {
    progress.log(options.text);
  }

  try {
    const result = await operation();
    
    if (progress instanceof Progress) {
      progress.succeed();
    } else {
      progress.success(options.text);
    }
    
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    if (progress instanceof Progress) {
      progress.fail(message);
    } else {
      progress.error(message);
    }
    
    throw error;
  }
}