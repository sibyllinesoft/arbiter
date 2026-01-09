import { executeCommand, generateId } from "../../io/utils";
/**
 * @module util/specEngine/assertions
 * Assertion processing and command implementations for spec validation.
 */
import type { ValidationError } from "../types";

/**
 * Interface for assertion configurations
 */
export interface AssertionConfig {
  query: string;
  description: string;
  threshold?: number;
  type?: string;
}

/**
 * Interface for assertion commands
 */
export interface AssertionCommand {
  execute(tempFilePath: string, jqBinaryPath: string): Promise<ValidationError | null>;
  getConfig(): AssertionConfig;
}

/**
 * Result of assertion processing
 */
export interface AssertionResult {
  success: boolean;
  value?: number;
  error?: string;
}

/**
 * Manages temporary file creation and cleanup
 */
export class TempFileManager {
  private tempFile: string;

  constructor(_data: Record<string, unknown>) {
    this.tempFile = `/tmp/resolved_${generateId()}.json`;
  }

  async create(data: Record<string, unknown>): Promise<void> {
    const resolvedJson = JSON.stringify(data, null, 2);
    await Bun.write(this.tempFile, resolvedJson);
  }

  getPath(): string {
    return this.tempFile;
  }

  async cleanup(): Promise<void> {
    try {
      const exists = await Bun.file(this.tempFile).exists();
      if (exists) {
        await Bun.write(this.tempFile, "");
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Processes and parses assertion results
 */
export class AssertionResultProcessor {
  static processCommandResult(result: any): AssertionResult {
    if (result.success) {
      const value = Number.parseInt(result.stdout.trim(), 10) || 0;
      return { success: true, value };
    }
    return { success: false, error: result.stderr };
  }

  static createValidationError(
    config: AssertionConfig,
    result: AssertionResult,
    errorType:
      | "execution"
      | "command_failed"
      | "threshold_exceeded"
      | "minimum_not_met" = "threshold_exceeded",
    error?: Error,
  ): ValidationError {
    if (error) {
      return {
        type: "assertion",
        message: `jq execution error for ${config.description}`,
        details: {
          query: config.query,
          error: error.message,
        },
      };
    }

    if (!result.success) {
      return {
        type: "assertion",
        message: `jq assertion failed: ${config.description}`,
        details: {
          query: config.query,
          error: result.error,
        },
      };
    }

    // Create appropriate error message based on error type
    let message: string;
    switch (errorType) {
      case "threshold_exceeded":
        message = `${config.description}: expected <= ${config.threshold}, got ${result.value}`;
        break;
      case "minimum_not_met":
        message = `${config.description}: expected >= ${config.threshold}, got ${result.value}`;
        break;
      default:
        message = `${config.description}: assertion failed`;
    }

    return {
      type: "assertion",
      message,
      details: {
        query: config.query,
        value: result.value,
        threshold: config.threshold,
      },
    };
  }
}

/**
 * Base template for assertion execution
 */
abstract class AbstractAssertionCommand implements AssertionCommand {
  protected config: AssertionConfig;

  constructor(config: AssertionConfig) {
    this.config = config;
  }

  async execute(tempFilePath: string, jqBinaryPath: string): Promise<ValidationError | null> {
    try {
      const commandResult = await this.executeJqCommand(tempFilePath, jqBinaryPath);
      const result = AssertionResultProcessor.processCommandResult(commandResult);

      if (!result.success) {
        return AssertionResultProcessor.createValidationError(
          this.config,
          result,
          "command_failed",
        );
      }

      if (this.shouldCreateError(result)) {
        return AssertionResultProcessor.createValidationError(
          this.config,
          result,
          this.getErrorType(),
        );
      }

      return null;
    } catch (error) {
      return AssertionResultProcessor.createValidationError(
        this.config,
        { success: false },
        "execution",
        error instanceof Error ? error : new Error("Unknown error"),
      );
    }
  }

  protected abstract shouldCreateError(result: AssertionResult): boolean;
  protected abstract getErrorType(): "threshold_exceeded" | "minimum_not_met";

  protected async executeJqCommand(tempFilePath: string, jqBinaryPath: string): Promise<any> {
    return executeCommand(jqBinaryPath, [this.config.query, tempFilePath], { timeout: 5000 });
  }

  getConfig(): AssertionConfig {
    return this.config;
  }
}

/**
 * Command for threshold-based assertions
 */
export class ThresholdAssertionCommand extends AbstractAssertionCommand {
  protected shouldCreateError(result: AssertionResult): boolean {
    return (
      this.config.threshold !== undefined &&
      result.value !== undefined &&
      result.value > this.config.threshold
    );
  }

  protected getErrorType(): "threshold_exceeded" | "minimum_not_met" {
    return "threshold_exceeded";
  }
}

/**
 * Command for minimum threshold assertions (must be >= threshold)
 */
export class MinimumThresholdCommand extends AbstractAssertionCommand {
  protected shouldCreateError(result: AssertionResult): boolean {
    return (
      this.config.threshold !== undefined &&
      result.value !== undefined &&
      result.value < this.config.threshold
    );
  }

  protected getErrorType(): "threshold_exceeded" | "minimum_not_met" {
    return "minimum_not_met";
  }
}

/**
 * Command for existence-based assertions
 */
export class ExistenceAssertionCommand extends AbstractAssertionCommand {
  protected shouldCreateError(result: AssertionResult): boolean {
    return result.value === 0;
  }

  protected getErrorType(): "threshold_exceeded" | "minimum_not_met" {
    return "minimum_not_met";
  }
}

/**
 * Builder for creating assertion commands
 */
export class AssertionCommandBuilder {
  private config: Partial<AssertionConfig> = {};

  static create(): AssertionCommandBuilder {
    return new AssertionCommandBuilder();
  }

  query(query: string): AssertionCommandBuilder {
    this.config.query = query;
    return this;
  }

  description(description: string): AssertionCommandBuilder {
    this.config.description = description;
    return this;
  }

  threshold(threshold: number): AssertionCommandBuilder {
    this.config.threshold = threshold;
    return this;
  }

  type(type: string): AssertionCommandBuilder {
    this.config.type = type;
    return this;
  }

  buildThreshold(): ThresholdAssertionCommand {
    if (!this.config.query || !this.config.description) {
      throw new Error("Query and description are required");
    }
    return new ThresholdAssertionCommand(this.config as AssertionConfig);
  }

  buildMinimum(): MinimumThresholdCommand {
    if (!this.config.query || !this.config.description) {
      throw new Error("Query and description are required");
    }
    return new MinimumThresholdCommand(this.config as AssertionConfig);
  }

  buildExistence(): ExistenceAssertionCommand {
    if (!this.config.query || !this.config.description) {
      throw new Error("Query and description are required");
    }
    return new ExistenceAssertionCommand(this.config as AssertionConfig);
  }
}

/**
 * Strategy for different assertion execution approaches
 */
export interface AssertionExecutionStrategy {
  execute(
    commands: AssertionCommand[],
    tempFilePath: string,
    jqBinaryPath: string,
  ): Promise<ValidationError[]>;
}

/**
 * Sequential execution strategy
 */
export class SequentialExecutionStrategy implements AssertionExecutionStrategy {
  async execute(
    commands: AssertionCommand[],
    tempFilePath: string,
    jqBinaryPath: string,
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    for (const command of commands) {
      const error = await command.execute(tempFilePath, jqBinaryPath);
      if (error) {
        errors.push(error);
      }
    }
    return errors;
  }
}

/**
 * Parallel execution strategy
 */
export class ParallelExecutionStrategy implements AssertionExecutionStrategy {
  async execute(
    commands: AssertionCommand[],
    tempFilePath: string,
    jqBinaryPath: string,
  ): Promise<ValidationError[]> {
    const results = await Promise.allSettled(
      commands.map((cmd) => cmd.execute(tempFilePath, jqBinaryPath)),
    );
    return results
      .filter(
        (result): result is PromiseFulfilledResult<ValidationError | null> =>
          result.status === "fulfilled" && result.value !== null,
      )
      .map((result) => result.value!);
  }
}

/**
 * Assertion executor using strategy pattern
 */
export class AssertionExecutor {
  private strategy: AssertionExecutionStrategy;
  private commands: AssertionCommand[] = [];

  constructor(strategy: AssertionExecutionStrategy = new SequentialExecutionStrategy()) {
    this.strategy = strategy;
  }

  addCommand(command: AssertionCommand): this {
    this.commands.push(command);
    return this;
  }

  addCommands(commands: AssertionCommand[]): this {
    this.commands.push(...commands);
    return this;
  }

  async execute(tempFilePath: string, jqBinaryPath: string): Promise<ValidationError[]> {
    return this.strategy.execute(this.commands, tempFilePath, jqBinaryPath);
  }

  getCommandCount(): number {
    return this.commands.length;
  }

  clear(): void {
    this.commands = [];
  }
}
