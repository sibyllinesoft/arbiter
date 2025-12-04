/**
 * Spec validation engine with CUE and jq integration
 */
import { join } from "node:path";
import { type CueDiagnostic, CueRunner } from "@arbiter/cue-runner";
import type {
  ExternalToolResult,
  Fragment,
  ServerConfig,
  ValidationError,
  ValidationWarning,
} from "./types";
import { computeSpecHash, ensureDir, executeCommand, formatCUE, generateId, logger } from "./utils";

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

  private createCueRunner(projectId: string): CueRunner {
    return new CueRunner({
      cwd: this.getFragmentsDir(projectId),
      timeoutMs: this.config.external_tool_timeout_ms,
    });
  }

  private cueDiagnosticsToValidationErrors(diagnostics: CueDiagnostic[]): ValidationError[] {
    return diagnostics.map((diag) => {
      const detailEntries: Record<string, unknown> = {
        raw: diag.raw,
      };

      if (diag.file) {
        detailEntries.file = diag.file;
      }
      if (typeof diag.line === "number") {
        detailEntries.line = diag.line;
      }
      if (typeof diag.column === "number") {
        detailEntries.column = diag.column;
      }
      if (diag.summary) {
        detailEntries.summary = diag.summary;
      }

      const location = diag.file ? `${diag.file}:${diag.line ?? 0}:${diag.column ?? 0}` : undefined;

      return {
        type: "schema" as const,
        message: diag.message,
        ...(location ? { location } : {}),
        details: detailEntries,
      };
    });
  }

  /**
   * Write fragments to filesystem for CUE processing
   */
  private async writeFragmentsToFS(projectId: string, fragments: Fragment[]): Promise<void> {
    const fragmentsDir = this.getFragmentsDir(projectId);
    await ensureDir(fragmentsDir);

    // Write each fragment to its path
    for (const fragment of fragments) {
      // Ensure fragment path has .cue extension
      const fragmentFileName = fragment.path.endsWith(".cue")
        ? fragment.path
        : `${fragment.path}.cue`;
      const fragmentPath = join(fragmentsDir, fragmentFileName);
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
    return formatCUE(content);
  }

  /**
   * Run CUE validation (cue vet)
   */
  private async runCueValidation(projectId: string): Promise<ValidationError[]> {
    try {
      const runner = this.createCueRunner(projectId);
      const vetResult = await runner.vet();

      this.logCueValidationResult(projectId, vetResult.raw, vetResult.diagnostics);

      if (vetResult.success) {
        return [];
      }

      const diagnostics = this.cueDiagnosticsToValidationErrors(vetResult.diagnostics);
      if (diagnostics.length > 0) {
        return diagnostics;
      }

      return [
        {
          type: "schema",
          message: vetResult.raw.stderr || "CUE validation failed",
        },
      ];
    } catch (error) {
      return this.handleCueValidationError(projectId, error);
    }
  }

  /**
   * Log CUE validation completion
   */
  private logCueValidationResult(
    projectId: string,
    result: ExternalToolResult,
    diagnostics: CueDiagnostic[],
  ): void {
    logger.debug("CUE validation completed", {
      projectId,
      success: result.success,
      errorCount: diagnostics.length,
      duration: result.durationMs,
    });
  }

  /**
   * Handle CUE validation errors
   */
  private handleCueValidationError(projectId: string, error: unknown): ValidationError[] {
    const validationError: ValidationError = {
      type: "schema",
      message: `CUE validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };

    logger.error("CUE validation error", error instanceof Error ? error : undefined, {
      projectId,
    });

    return [validationError];
  }

  /**
   * Export resolved specification (cue export)
   */
  private async exportResolvedSpec(projectId: string): Promise<{
    success: boolean;
    resolved?: Record<string, unknown>;
    error?: string;
    diagnostics?: CueDiagnostic[];
  }> {
    try {
      const runner = this.createCueRunner(projectId);
      const exportResult = await runner.exportJson();

      if (exportResult.success && exportResult.value) {
        logger.debug("CUE export completed", {
          projectId,
          duration: exportResult.raw.durationMs,
        });

        return { success: true, resolved: exportResult.value };
      }

      return {
        success: false,
        error: exportResult.error,
        diagnostics: exportResult.diagnostics,
      };
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
      // Check for undefined capabilities
      if (typeof resolved === "object" && resolved !== null) {
        const capabilities = (resolved as any).capabilities;

        if (!capabilities || Object.keys(capabilities).length === 0) {
          errors.push({
            type: "custom",
            message: "No capabilities defined in specification",
          });
        }

        // Detect overlapping / duplicate capability namespaces (e.g., "user.auth" and "user.auth.login")
        const capabilityIds = Object.keys(capabilities || {});
        const overlaps = new Set<string>();
        for (let i = 0; i < capabilityIds.length; i++) {
          for (let j = i + 1; j < capabilityIds.length; j++) {
            const a = capabilityIds[i];
            const b = capabilityIds[j];
            if (a === b) continue;
            if (a.startsWith(`${b}.`) || b.startsWith(`${a}.`)) {
              const key = a.startsWith(`${b}.`) ? `${b}->${a}` : `${a}->${b}`;
              if (!overlaps.has(key)) {
                overlaps.add(key);
                warnings.push({
                  type: "duplicate",
                  message: `Capability "${a.startsWith(`${b}.`) ? a : b}" overlaps with parent capability "${a.startsWith(`${b}.`) ? b : a}"`,
                });
              }
            }
          }
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
      // Execute the main validation workflow
      const result = await this.executeValidationWorkflow(projectId, fragments);

      // Log completion metrics
      this.logValidationCompletion(projectId, result, Date.now() - startTime);

      return result;
    } catch (error) {
      return this.handleValidationError(projectId, error, Date.now() - startTime);
    }
  }

  /**
   * Execute the core validation workflow steps
   */
  private async executeValidationWorkflow(
    projectId: string,
    fragments: Fragment[],
  ): Promise<{
    success: boolean;
    specHash: string;
    resolved?: Record<string, unknown>;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    // Step 1: Write fragments to filesystem
    await this.writeFragmentsToFS(projectId, fragments);

    // Step 2: Run CUE validation
    let schemaErrors = await this.runCueValidation(projectId);

    // Step 3: Export resolved specification
    const exportResult = await this.exportResolvedSpec(projectId);

    // Handle export failure early
    if (!exportResult.success || !exportResult.resolved) {
      if (exportResult.diagnostics && exportResult.diagnostics.length > 0) {
        schemaErrors = schemaErrors.concat(
          this.cueDiagnosticsToValidationErrors(exportResult.diagnostics),
        );
      }

      return this.createFailureResult(schemaErrors, exportResult.error);
    }

    // Step 4-6: Process successful export
    return await this.processSuccessfulExport(exportResult.resolved, schemaErrors);
  }

  /**
   * Create validation result for export failures
   */
  private createFailureResult(
    errors: ValidationError[],
    exportError?: string,
  ): {
    success: boolean;
    specHash: string;
    resolved?: Record<string, unknown>;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const aggregated = [...errors];

    if (exportError) {
      aggregated.push({
        type: "schema",
        message: exportError,
      });
    }

    return {
      success: false,
      specHash: "",
      errors: aggregated,
      warnings: [],
    };
  }

  /**
   * Process successful spec export through remaining validation steps
   */
  private async processSuccessfulExport(
    resolved: Record<string, unknown>,
    schemaErrors: ValidationError[],
  ): Promise<{
    success: boolean;
    specHash: string;
    resolved?: Record<string, unknown>;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    // Compute spec hash
    const resolvedJson = JSON.stringify(resolved);
    const computedSpecHash = computeSpecHash(resolvedJson);

    // Run remaining validation steps
    const assertionErrors = await this.runJqAssertions(resolved);
    const customValidation = await this.runCustomValidators(resolved);

    // Aggregate all results
    const allErrors = [...schemaErrors, ...assertionErrors, ...customValidation.errors];
    const success = allErrors.length === 0;

    return {
      success,
      specHash: success ? computedSpecHash : "",
      resolved,
      errors: allErrors,
      warnings: customValidation.warnings,
    };
  }

  /**
   * Log validation completion metrics
   */
  private logValidationCompletion(
    projectId: string,
    result: {
      success: boolean;
      specHash: string;
      errors: ValidationError[];
      warnings: ValidationWarning[];
    },
    duration: number,
  ): void {
    // Reduced logging - only log validation failures or significant events
    const errorCount = result.errors.length;
    const warningCount = result.warnings.length;
    if (!result.success || errorCount > 0) {
      logger.info("Validation completed", {
        projectId,
        success: result.success,
        specHash: result.specHash,
        errorCount,
        warningCount,
        duration,
      });
    }
  }

  /**
   * Handle validation pipeline errors
   */
  private handleValidationError(
    projectId: string,
    error: unknown,
    duration: number,
  ): {
    success: boolean;
    specHash: string;
    resolved?: Record<string, unknown>;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
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
