/**
 * @module util/specEngine
 * Spec validation engine with CUE and jq integration.
 */
import { join } from "node:path";
import { type CueDiagnostic, CueRunner } from "@arbiter/cue-runner";
import { computeSpecHash, ensureDir, executeCommand, formatCUE, logger } from "../../io/utils";
import type {
  ExternalToolResult,
  Fragment,
  ServerConfig,
  ValidationError,
  ValidationWarning,
} from "../types";
import {
  AssertionCommandBuilder,
  AssertionExecutor,
  ParallelExecutionStrategy,
  TempFileManager,
} from "./assertions";

export {
  AssertionCommandBuilder,
  AssertionExecutor,
  AssertionResultProcessor,
  ExistenceAssertionCommand,
  MinimumThresholdCommand,
  ParallelExecutionStrategy,
  SequentialExecutionStrategy,
  TempFileManager,
  ThresholdAssertionCommand,
  type AssertionCommand,
  type AssertionConfig,
  type AssertionExecutionStrategy,
  type AssertionResult,
} from "./assertions";

/**
 * Internal assertion executor that uses the server config
 */
class ConfiguredAssertionExecutor {
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  async execute(resolved: Record<string, unknown>): Promise<ValidationError[]> {
    const jqBinaryPath = this.config.jq_binary_path;
    if (!jqBinaryPath) {
      return [];
    }

    const tempFileManager = new TempFileManager(resolved);
    try {
      await tempFileManager.create(resolved);

      const commands = this.buildDefaultAssertions();
      const executor = new AssertionExecutor(new ParallelExecutionStrategy());
      executor.addCommands(commands);

      return executor.execute(tempFileManager.getPath(), jqBinaryPath);
    } finally {
      await tempFileManager.cleanup();
    }
  }

  private buildDefaultAssertions() {
    return [
      AssertionCommandBuilder.create()
        .query('[.. | strings | select(test("\\\\$\\\\{.*\\\\}"))] | length')
        .description("Unresolved tokens")
        .threshold(0)
        .buildThreshold(),
    ];
  }
}

export class SpecEngine {
  constructor(private config: ServerConfig) {}

  private getProjectDir(projectId: string): string {
    return join(this.config.spec_workdir, projectId);
  }

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

  private async writeFragmentsToFS(projectId: string, fragments: Fragment[]): Promise<void> {
    const fragmentsDir = this.getFragmentsDir(projectId);
    await ensureDir(fragmentsDir);

    for (const fragment of fragments) {
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

  async formatFragment(
    content: string,
  ): Promise<{ formatted: string; success: boolean; error?: string }> {
    return formatCUE(content);
  }

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

  private async runJqAssertions(resolved: Record<string, unknown>): Promise<ValidationError[]> {
    const executor = new ConfiguredAssertionExecutor(this.config);
    return executor.execute(resolved);
  }

  private async runCustomValidators(
    resolved: Record<string, unknown>,
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      if (typeof resolved === "object" && resolved !== null) {
        const capabilities = (resolved as any).capabilities;

        if (!capabilities || Object.keys(capabilities).length === 0) {
          errors.push({
            type: "custom",
            message: "No capabilities defined in specification",
          });
        }

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
    } catch (error) {
      errors.push({
        type: "custom",
        message: `Custom validator error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    return { errors, warnings };
  }

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
      const result = await this.executeValidationWorkflow(projectId, fragments);
      this.logValidationCompletion(projectId, result, Date.now() - startTime);
      return result;
    } catch (error) {
      return this.handleValidationError(projectId, error, Date.now() - startTime);
    }
  }

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
    await this.writeFragmentsToFS(projectId, fragments);
    let schemaErrors = await this.runCueValidation(projectId);
    const exportResult = await this.exportResolvedSpec(projectId);

    if (!exportResult.success || !exportResult.resolved) {
      if (exportResult.diagnostics && exportResult.diagnostics.length > 0) {
        schemaErrors = schemaErrors.concat(
          this.cueDiagnosticsToValidationErrors(exportResult.diagnostics),
        );
      }
      return this.createFailureResult(schemaErrors, exportResult.error);
    }

    return await this.processSuccessfulExport(exportResult.resolved, schemaErrors);
  }

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
    const resolvedJson = JSON.stringify(resolved);
    const computedSpecHash = computeSpecHash(resolvedJson);

    const assertionErrors = await this.runJqAssertions(resolved);
    const customValidation = await this.runCustomValidators(resolved);

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

  async cleanupProject(projectId: string): Promise<void> {
    try {
      const projectDir = this.getProjectDir(projectId);
      await executeCommand("rm", ["-rf", projectDir]);
      logger.debug("Cleaned up project workspace", { projectId });
    } catch (error) {
      logger.error(
        "Failed to cleanup project workspace",
        error instanceof Error ? error : undefined,
        { projectId },
      );
    }
  }
}
