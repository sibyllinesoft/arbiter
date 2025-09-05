/**
 * Spec validation engine with CUE and jq integration
 */
import { join } from "node:path";
import type {
  CoverageGap,
  Duplicate,
  Fragment,
  GapSet,
  ServerConfig,
  TokenReference,
  ValidationError,
  ValidationWarning,
} from "./types.ts";
import {
  computeSpecHash,
  ensureDir,
  executeCommand,
  formatCUE,
  generateId,
  logger,
  safeJsonParse,
} from "./utils.ts";

/**
 * Interface for assertion configurations
 */
interface AssertionConfig {
  query: string;
  description: string;
  threshold?: number;
  type?: string;
}

/**
 * Interface for assertion commands
 */
interface AssertionCommand {
  execute(tempFilePath: string, jqBinaryPath: string): Promise<ValidationError | null>;
  getConfig(): AssertionConfig;
}

/**
 * Result of assertion processing
 */
interface AssertionResult {
  success: boolean;
  value?: number;
  error?: string;
}

/**
 * Manages temporary file creation and cleanup
 */
class TempFileManager {
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
class AssertionResultProcessor {
  static processCommandResult(result: any): AssertionResult {
    if (result.success) {
      const value = parseInt(result.stdout.trim(), 10) || 0;
      return { success: true, value };
    } else {
      return { success: false, error: result.stderr };
    }
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
class ThresholdAssertionCommand extends AbstractAssertionCommand {
  protected shouldCreateError(result: AssertionResult): boolean {
    // For threshold assertions, we fail when the value exceeds the threshold
    // For "unresolved tokens", threshold=0 means we fail if there are ANY (>0)
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
class MinimumThresholdCommand extends AbstractAssertionCommand {
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
class ExistenceAssertionCommand extends AbstractAssertionCommand {
  protected shouldCreateError(result: AssertionResult): boolean {
    return result.value === 0; // Fail if nothing exists
  }

  protected getErrorType(): "threshold_exceeded" | "minimum_not_met" {
    return "minimum_not_met"; // Existence is essentially minimum threshold of 1
  }
}

/**
 * Builder for creating assertion commands
 */
class AssertionCommandBuilder {
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
interface AssertionExecutionStrategy {
  execute(
    commands: AssertionCommand[],
    tempFilePath: string,
    jqBinaryPath: string,
  ): Promise<ValidationError[]>;
}

/**
 * Sequential execution strategy
 */
class SequentialExecutionStrategy implements AssertionExecutionStrategy {
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
class ParallelExecutionStrategy implements AssertionExecutionStrategy {
  async execute(
    commands: AssertionCommand[],
    tempFilePath: string,
    jqBinaryPath: string,
  ): Promise<ValidationError[]> {
    const promises = commands.map((command) => command.execute(tempFilePath, jqBinaryPath));

    const results = await Promise.all(promises);
    return results.filter((error): error is ValidationError => error !== null);
  }
}

/**
 * Main assertion executor class
 */
class AssertionExecutor {
  private strategy: AssertionExecutionStrategy;
  private commands: AssertionCommand[];

  constructor(private config: ServerConfig) {
    this.strategy = new SequentialExecutionStrategy(); // Default to sequential
    this.commands = this.buildDefaultAssertions();
  }

  setStrategy(strategy: AssertionExecutionStrategy): void {
    this.strategy = strategy;
  }

  addCommand(command: AssertionCommand): void {
    this.commands.push(command);
  }

  async execute(resolved: Record<string, unknown>): Promise<ValidationError[]> {
    const tempFileManager = new TempFileManager(resolved);

    try {
      await tempFileManager.create(resolved);

      return await this.strategy.execute(
        this.commands,
        tempFileManager.getPath(),
        this.config.jq_binary_path,
      );
    } catch (error) {
      return [
        {
          type: "assertion",
          message: "Failed to create temporary file for jq processing",
          details: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      ];
    } finally {
      await tempFileManager.cleanup();
    }
  }

  private buildDefaultAssertions(): AssertionCommand[] {
    return [
      AssertionCommandBuilder.create()
        .query(
          '[paths(scalars) as $p | select(getpath($p) | type == "string" and test("[$][{][^}]+[}]")) | $p] | length',
        )
        .description("Check for unresolved template tokens")
        .threshold(0)
        .buildThreshold(), // Fail if > 0 tokens found

      // Note: Capabilities validation is handled by custom validators, not jq assertions
      // This keeps the jq assertions focused on structural checks
    ];
  }
}

export class SpecEngine {
  constructor(private config: ServerConfig) {}

  /**
   * Get the project directory path
   */
  private getProjectDir(projectId: string): string {
    return join(this.config.spec_workdir, projectId);
  }

  /**
   * Get the fragments directory path
   */
  private getFragmentsDir(projectId: string): string {
    return join(this.getProjectDir(projectId), "fragments");
  }

  /**
   * Write fragments to filesystem for CUE processing
   */
  private async writeFragmentsToFS(projectId: string, fragments: Fragment[]): Promise<void> {
    const fragmentsDir = this.getFragmentsDir(projectId);
    await ensureDir(fragmentsDir);

    // Write each fragment to its path
    for (const fragment of fragments) {
      const fragmentPath = join(fragmentsDir, fragment.path);
      const fragmentDir = join(fragmentPath, "..");

      await ensureDir(fragmentDir);
      await Bun.write(fragmentPath, fragment.content);
    }

    logger.debug("Wrote fragments to filesystem", {
      projectId,
      fragmentCount: fragments.length,
    });
  }

  /**
   * Format CUE fragment content
   */
  async formatFragment(
    content: string,
  ): Promise<{ formatted: string; success: boolean; error?: string }> {
    return formatCUE(content, this.config.cue_binary_path);
  }

  /**
   * Run CUE validation (cue vet)
   */
  private async runCueValidation(projectId: string): Promise<ValidationError[]> {
    const fragmentsDir = this.getFragmentsDir(projectId);
    const errors: ValidationError[] = [];

    try {
      const result = await executeCommand(this.config.cue_binary_path, ["vet", "."], {
        cwd: fragmentsDir,
        timeout: this.config.external_tool_timeout_ms,
      });

      if (!result.success && result.stderr) {
        // Parse CUE validation errors
        const lines = result.stderr.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          // CUE error format: filename:line:column: message
          const match = line.match(/^([^:]+):(\d+):(\d+):\s*(.+)$/);

          if (match) {
            const [, file, lineNum, col, message] = match;
            errors.push({
              type: "schema",
              message: message?.trim() || "Unknown error",
              location: `${file}:${lineNum}:${col}`,
              details: {
                file,
                line: parseInt(lineNum || "0", 10),
                column: parseInt(col || "0", 10),
              },
            });
          } else {
            // Generic error format
            errors.push({
              type: "schema",
              message: line.trim(),
            });
          }
        }
      }

      logger.debug("CUE validation completed", {
        projectId,
        success: result.success,
        errorCount: errors.length,
        duration: result.duration_ms,
      });
    } catch (error) {
      errors.push({
        type: "schema",
        message: `CUE validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });

      logger.error("CUE validation error", error instanceof Error ? error : undefined, {
        projectId,
      });
    }

    return errors;
  }

  /**
   * Export resolved specification (cue export)
   */
  private async exportResolvedSpec(projectId: string): Promise<{
    success: boolean;
    resolved?: Record<string, unknown>;
    error?: string;
  }> {
    const fragmentsDir = this.getFragmentsDir(projectId);

    try {
      const result = await executeCommand(
        this.config.cue_binary_path,
        ["export", "--out", "json"],
        {
          cwd: fragmentsDir,
          timeout: this.config.external_tool_timeout_ms,
        },
      );

      if (result.success && result.stdout) {
        const parseResult = safeJsonParse(result.stdout);

        if (parseResult.success) {
          logger.debug("CUE export completed", {
            projectId,
            duration: result.duration_ms,
          });

          return { success: true, resolved: parseResult.data };
        } else {
          return {
            success: false,
            error: `Invalid JSON from CUE export: ${parseResult.error}`,
          };
        }
      } else {
        return {
          success: false,
          error: result.stderr || "CUE export failed with no output",
        };
      }
    } catch (error) {
      logger.error("CUE export error", error instanceof Error ? error : undefined, { projectId });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Run jq assertions on resolved specification
   */
  private async runJqAssertions(resolved: Record<string, unknown>): Promise<ValidationError[]> {
    const executor = new AssertionExecutor(this.config);
    return executor.execute(resolved);
  }

  /**
   * Run custom TypeScript validators
   */
  private async runCustomValidators(
    resolved: Record<string, unknown>,
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Validate duplicates
      const duplicateCheck = this.findDuplicates(resolved);
      duplicateCheck.forEach((duplicate) => {
        warnings.push({
          type: "duplicate",
          message: `Duplicate ${duplicate.type}: ${duplicate.name}`,
          location: duplicate.locations.join(", "),
        });
      });

      // Check for undefined capabilities
      if (typeof resolved === "object" && resolved !== null) {
        const capabilities = (resolved as any).capabilities;

        if (!capabilities || Object.keys(capabilities).length === 0) {
          errors.push({
            type: "custom",
            message: "No capabilities defined in specification",
          });
        }
      }

      // Add more custom validations as needed
    } catch (error) {
      errors.push({
        type: "custom",
        message: `Custom validator error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    return { errors, warnings };
  }

  /**
   * Find duplicates in the resolved specification
   */
  private findDuplicates(resolved: Record<string, unknown>): Duplicate[] {
    const duplicates: Duplicate[] = [];

    try {
      // This is a simplified implementation
      // In a real system, you'd want more sophisticated duplicate detection

      if (typeof resolved === "object" && resolved !== null) {
        const capabilities = (resolved as any).capabilities || {};
        const capabilityNames = Object.keys(capabilities);
        const nameCount: Record<string, string[]> = {};

        // Count occurrences of capability names
        capabilityNames.forEach((name) => {
          const parts = name.split(".");
          parts.forEach((part) => {
            if (!nameCount[part]) nameCount[part] = [];
            nameCount[part].push(name);
          });
        });

        // Find duplicates
        Object.entries(nameCount).forEach(([name, locations]) => {
          if (locations.length > 1) {
            duplicates.push({
              type: "capability",
              name,
              locations,
            });
          }
        });
      }
    } catch (error) {
      logger.error("Error finding duplicates", error instanceof Error ? error : undefined);
    }

    return duplicates;
  }

  /**
   * Complete validation pipeline
   */
  async validateProject(
    projectId: string,
    fragments: Fragment[],
  ): Promise<{
    success: boolean;
    specHash: string;
    resolved?: Record<string, unknown>;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    const startTime = Date.now();

    try {
      // Step 1: Write fragments to filesystem
      await this.writeFragmentsToFS(projectId, fragments);

      // Step 2: Run CUE validation
      const schemaErrors = await this.runCueValidation(projectId);

      // Step 3: Export resolved specification
      const exportResult = await this.exportResolvedSpec(projectId);

      if (!exportResult.success || !exportResult.resolved) {
        return {
          success: false,
          specHash: "",
          errors: [
            ...schemaErrors,
            {
              type: "schema",
              message: exportResult.error || "Failed to export resolved specification",
            },
          ],
          warnings: [],
        };
      }

      // Step 4: Compute spec hash
      const specHash = computeSpecHash(JSON.stringify(exportResult.resolved));

      // Step 5: Run jq assertions
      const assertionErrors = await this.runJqAssertions(exportResult.resolved);

      // Step 6: Run custom validators
      const customValidation = await this.runCustomValidators(exportResult.resolved);

      const allErrors = [...schemaErrors, ...assertionErrors, ...customValidation.errors];
      const success = allErrors.length === 0;

      const duration = Date.now() - startTime;

      logger.info("Validation completed", {
        projectId,
        success,
        specHash,
        errorCount: allErrors.length,
        warningCount: customValidation.warnings.length,
        duration,
      });

      return {
        success,
        specHash,
        resolved: exportResult.resolved,
        errors: allErrors,
        warnings: customValidation.warnings,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error("Validation pipeline error", error instanceof Error ? error : undefined, {
        projectId,
        duration,
      });

      return {
        success: false,
        specHash: "",
        errors: [
          {
            type: "custom",
            message: `Validation pipeline failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Generate gap analysis
   */
  async generateGapSet(resolved: Record<string, unknown>): Promise<GapSet> {
    try {
      // This is a simplified implementation
      // In practice, you'd want more sophisticated gap analysis

      const missing_capabilities: string[] = [];
      const orphaned_tokens: TokenReference[] = [];
      const coverage_gaps: CoverageGap[] = [];
      const duplicates = this.findDuplicates(resolved);

      // Find orphaned tokens by looking for unresolved template expressions
      const jsonStr = JSON.stringify(resolved);
      const tokenMatches = jsonStr.match(/\$\{[^}]+\}/g) || [];

      tokenMatches.forEach((token) => {
        orphaned_tokens.push({
          token,
          defined_in: [],
          referenced_in: ["resolved.json"],
        });
      });

      // Analyze coverage gaps (simplified)
      if (typeof resolved === "object" && resolved !== null) {
        const capabilities = (resolved as any).capabilities || {};
        const tests = (resolved as any).tests || {};

        Object.keys(capabilities).forEach((capability) => {
          const hasTests = Object.keys(tests).some(
            (test) => test.includes(capability) || tests[test]?.covers?.includes(capability),
          );

          if (!hasTests) {
            coverage_gaps.push({
              capability,
              expected_coverage: 100,
              actual_coverage: 0,
              missing_scenarios: ["basic", "error_handling", "edge_cases"],
            });
          }
        });
      }

      return {
        missing_capabilities,
        orphaned_tokens,
        coverage_gaps,
        duplicates,
      };
    } catch (error) {
      logger.error("Gap analysis error", error instanceof Error ? error : undefined);

      return {
        missing_capabilities: [],
        orphaned_tokens: [],
        coverage_gaps: [],
        duplicates: [],
      };
    }
  }

  /**
   * Clean up project workspace
   */
  async cleanupProject(projectId: string): Promise<void> {
    try {
      const projectDir = this.getProjectDir(projectId);
      await executeCommand("rm", ["-rf", projectDir]);

      logger.debug("Cleaned up project workspace", { projectId });
    } catch (error) {
      logger.error(
        "Failed to cleanup project workspace",
        error instanceof Error ? error : undefined,
        {
          projectId,
        },
      );
    }
  }
}
