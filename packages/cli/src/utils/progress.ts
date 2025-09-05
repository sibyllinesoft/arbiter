import chalk from "chalk";
import ora, { type Ora } from "ora";
import type { ProgressBarOptions, ProgressOptions, StepProgressOptions } from "../types.js";

/**
 * Enhanced progress indicator utility class with step-by-step tracking
 */
export class Progress {
  private spinner: Ora;
  private startTime: number;
  private steps: Array<{
    name: string;
    status: "pending" | "running" | "completed" | "failed";
    startTime?: number;
    endTime?: number;
  }>;
  private currentStep: number = -1;
  private totalSteps: number = 0;

  constructor(options: ProgressOptions) {
    this.spinner = ora({
      text: options.text,
      color: options.color || "blue",
      spinner: options.spinner || "dots",
    });
    this.startTime = Date.now();
    this.steps = [];
  }

  /**
   * Initialize steps for step-by-step progress tracking
   */
  addSteps(stepNames: string[]): void {
    this.steps = stepNames.map((name) => ({ name, status: "pending" }));
    this.totalSteps = this.steps.length;
  }

  /**
   * Start the progress indicator
   */
  start(): void {
    this.spinner.start();
  }

  /**
   * Start the next step in the sequence
   */
  nextStep(stepName?: string): void {
    // Complete previous step if any
    if (this.currentStep >= 0 && this.currentStep < this.steps.length) {
      this.steps[this.currentStep].status = "completed";
      this.steps[this.currentStep].endTime = Date.now();
    }

    // Move to next step
    this.currentStep++;
    if (this.currentStep < this.steps.length) {
      this.steps[this.currentStep].status = "running";
      this.steps[this.currentStep].startTime = Date.now();

      const currentStepName = stepName || this.steps[this.currentStep].name;
      const progress = `(${this.currentStep + 1}/${this.totalSteps})`;
      this.update(`${currentStepName} ${chalk.dim(progress)}`);
    }
  }

  /**
   * Mark current step as failed
   */
  failCurrentStep(error?: string): void {
    if (this.currentStep >= 0 && this.currentStep < this.steps.length) {
      this.steps[this.currentStep].status = "failed";
      this.steps[this.currentStep].endTime = Date.now();

      const stepName = this.steps[this.currentStep].name;
      const errorMsg = error ? `: ${error}` : "";
      this.fail(`${stepName} failed${errorMsg}`);
    }
  }

  /**
   * Update the progress text
   */
  update(text: string): void {
    this.spinner.text = text;
  }

  /**
   * Update with estimated time remaining
   */
  updateWithEstimate(text: string): void {
    const _elapsed = this.getElapsed();
    const estimate = this.getEstimatedTimeRemaining();
    const estimateText =
      estimate > 0 ? chalk.dim(` ~${Math.round(estimate / 1000)}s remaining`) : "";
    this.spinner.text = `${text}${estimateText}`;
  }

  /**
   * Mark as successful and stop
   */
  succeed(text?: string): void {
    // Complete current step if any
    if (this.currentStep >= 0 && this.currentStep < this.steps.length) {
      this.steps[this.currentStep].status = "completed";
      this.steps[this.currentStep].endTime = Date.now();
    }

    const elapsed = Date.now() - this.startTime;
    const message = text || this.spinner.text;
    const stepsSummary = this.totalSteps > 0 ? this.getStepsSummary() : "";
    this.spinner.succeed(`${message} ${chalk.dim(`(${elapsed}ms)`)}${stepsSummary}`);
  }

  /**
   * Mark as failed and stop
   */
  fail(text?: string): void {
    const elapsed = Date.now() - this.startTime;
    const message = text || this.spinner.text;
    const stepsSummary = this.totalSteps > 0 ? this.getStepsSummary() : "";
    this.spinner.fail(`${message} ${chalk.dim(`(${elapsed}ms)`)}${stepsSummary}`);
  }

  /**
   * Mark as warning and stop
   */
  warn(text?: string): void {
    const elapsed = Date.now() - this.startTime;
    const message = text || this.spinner.text;
    const stepsSummary = this.totalSteps > 0 ? this.getStepsSummary() : "";
    this.spinner.warn(`${message} ${chalk.dim(`(${elapsed}ms)`)}${stepsSummary}`);
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

  /**
   * Get estimated time remaining based on completed steps
   */
  getEstimatedTimeRemaining(): number {
    if (this.totalSteps === 0 || this.currentStep < 0) return 0;

    const completedSteps = this.steps.filter((step) => step.status === "completed");
    if (completedSteps.length === 0) return 0;

    const avgTimePerStep =
      completedSteps.reduce((total, step) => {
        return total + ((step.endTime || Date.now()) - (step.startTime || this.startTime));
      }, 0) / completedSteps.length;

    const remainingSteps = this.totalSteps - this.currentStep - 1;
    return remainingSteps * avgTimePerStep;
  }

  /**
   * Get a summary of completed steps
   */
  getStepsSummary(): string {
    if (this.totalSteps === 0) return "";

    const completed = this.steps.filter((s) => s.status === "completed").length;
    const failed = this.steps.filter((s) => s.status === "failed").length;

    if (failed > 0) {
      return chalk.dim(` [${completed}/${this.totalSteps} completed, ${failed} failed]`);
    }
    return chalk.dim(` [${completed}/${this.totalSteps} completed]`);
  }

  /**
   * Get detailed steps report for debugging
   */
  getStepsReport(): string {
    if (this.totalSteps === 0) return "";

    return (
      "\n" +
      this.steps
        .map((step, _index) => {
          const icon =
            step.status === "completed"
              ? "✓"
              : step.status === "failed"
                ? "✗"
                : step.status === "running"
                  ? "⚬"
                  : "○";
          const color =
            step.status === "completed"
              ? chalk.green
              : step.status === "failed"
                ? chalk.red
                : step.status === "running"
                  ? chalk.yellow
                  : chalk.dim;

          const duration =
            step.startTime && step.endTime
              ? ` (${step.endTime - step.startTime}ms)`
              : step.startTime && !step.endTime
                ? ` (${Date.now() - step.startTime}ms ongoing)`
                : "";

          return `  ${color(icon)} ${step.name}${chalk.dim(duration)}`;
        })
        .join("\n")
    );
  }
}

/**
 * Progress bar for operations with known progress (0-100%)
 */
export class ProgressBar {
  private current: number = 0;
  private total: number = 100;
  private startTime: number;
  private lastUpdate: number;
  private title: string;

  constructor(options: ProgressBarOptions) {
    this.title = options.title;
    this.total = options.total || 100;
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
  }

  /**
   * Update progress value
   */
  update(current: number, message?: string): void {
    this.current = Math.min(current, this.total);
    const now = Date.now();

    // Only update display every 100ms to avoid flickering
    if (now - this.lastUpdate > 100 || this.current === this.total) {
      this.render(message);
      this.lastUpdate = now;
    }
  }

  /**
   * Increment progress by amount
   */
  increment(amount: number = 1, message?: string): void {
    this.update(this.current + amount, message);
  }

  /**
   * Mark as complete
   */
  complete(message?: string): void {
    this.update(this.total, message);
    console.log(); // New line after progress bar
  }

  /**
   * Render the progress bar
   */
  private render(message?: string): void {
    if (!process.stdout.isTTY) {
      // Simple text progress for non-TTY environments
      const percent = Math.round((this.current / this.total) * 100);
      console.log(`${this.title}: ${percent}% ${message || ""}`);
      return;
    }

    const percent = (this.current / this.total) * 100;
    const width = Math.min(40, process.stdout.columns - 30); // Leave space for text
    const filled = Math.round((width * percent) / 100);
    const empty = width - filled;

    const bar = "█".repeat(filled) + "░".repeat(empty);
    const percentText = `${Math.round(percent).toString().padStart(3)}%`;
    const progressText = message ? ` ${message}` : "";
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const timeText = ` (${elapsed}s)`;

    // Clear line and render progress
    process.stdout.write(
      `\r${this.title}: [${chalk.cyan(bar)}] ${percentText}${progressText}${chalk.dim(timeText)}`,
    );
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
    this.progresses.forEach((progress) => {
      progress.update(text);
    });
  }

  /**
   * Stop all progress indicators
   */
  stopAll(): void {
    this.progresses.forEach((progress) => {
      progress.stop();
    });
    this.progresses.clear();
  }

  /**
   * Mark all as successful
   */
  succeedAll(text?: string): void {
    this.progresses.forEach((progress) => {
      progress.succeed(text);
    });
    this.progresses.clear();
  }

  /**
   * Mark all as failed
   */
  failAll(text?: string): void {
    this.progresses.forEach((progress) => {
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
 * Create appropriate progress indicator based on environment and type
 */
export function createProgress(options: ProgressOptions): Progress | SimpleProgress {
  // Use simple progress in CI or non-TTY environments
  if (!process.stdout.isTTY || process.env.CI) {
    return new SimpleProgress();
  }

  return new Progress(options);
}

/**
 * Create step-based progress indicator
 */
export function createStepProgress(options: StepProgressOptions): Progress | SimpleProgress {
  const progress = createProgress({ text: options.title });

  if (progress instanceof Progress) {
    progress.addSteps(options.steps);
  }

  return progress;
}

/**
 * Create progress bar for known-length operations
 */
export function createProgressBar(options: ProgressBarOptions): ProgressBar {
  return new ProgressBar(options);
}

/**
 * Measure and report performance of an operation
 */
export async function withProgress<T>(
  options: ProgressOptions,
  operation: () => Promise<T>,
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

/**
 * Execute multi-step operation with progress tracking
 */
export async function withStepProgress<T>(
  options: StepProgressOptions,
  operation: (progress: Progress | SimpleProgress) => Promise<T>,
): Promise<T> {
  const progress = createStepProgress(options);

  if (progress instanceof Progress) {
    progress.start();
  } else {
    progress.log(options.title);
  }

  try {
    const result = await operation(progress);

    if (progress instanceof Progress) {
      progress.succeed(`${options.title} completed`);
    } else {
      progress.success(options.title);
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

/**
 * Execute operation with progress bar (for known-length operations)
 */
export async function withProgressBar<T>(
  options: ProgressBarOptions,
  operation: (progressBar: ProgressBar) => Promise<T>,
): Promise<T> {
  const progressBar = createProgressBar(options);

  try {
    const result = await operation(progressBar);
    progressBar.complete(options.completeMessage || `${options.title} completed`);
    return result;
  } catch (error) {
    progressBar.complete(chalk.red(`${options.title} failed`));
    throw error;
  }
}
