import { EventEmitter } from "node:events";
import chalk from "chalk";
import type { CLIConfig } from "../types.js";
import {
  type Constraints,
  ConstraintViolationError,
  constrainedOperation,
  DEFAULT_CONSTRAINTS,
  globalConstraintEnforcer,
} from "./core.js";
import {
  bundleStandalone,
  copyStandalone,
  type FileSystemOperation,
  globalFileSystemConstraints,
  safeFileOperation,
} from "./filesystem.js";
import {
  globalIdempotencyValidator,
  type IdempotentOperation,
  validateIdempotentEdits,
  withIdempotencyValidation,
} from "./idempotency.js";
import {
  createSandboxValidator,
  initializeSandboxConfig,
  type SandboxedOperation,
  type SandboxValidator,
} from "./sandbox.js";
import {
  ensureLatestSchema,
  globalSchemaValidator,
  LATEST_API_VERSION,
  validateReadData,
} from "./schema.js";

/**
 * Comprehensive constraint violation summary
 */
export interface ConstraintViolationSummary {
  totalViolations: number;
  byConstraint: Record<string, number>;
  criticalViolations: string[];
  suggestions: string[];
  complianceRate: number;
}

/**
 * Constraint system status
 */
export interface ConstraintSystemStatus {
  isHealthy: boolean;
  constraints: Constraints;
  violations: ConstraintViolationSummary;
  sandbox: {
    activeOperations: number;
    complianceRate: number;
  };
  fileSystem: {
    symlinks: number;
    invalidPaths: number;
  };
  idempotency: {
    cacheSize: number;
    validations: number;
  };
  schema: {
    latestVersion: string;
    deprecatedWarnings: number;
  };
}

/**
 * Master constraint system that coordinates all constraint enforcement
 */
export class ConstraintSystem extends EventEmitter {
  private readonly constraints: Constraints;
  private readonly sandboxValidator: SandboxValidator;
  private readonly violationCounts = new Map<string, number>();

  constructor(config: CLIConfig, constraints: Partial<Constraints> = {}) {
    super();

    this.config = config;
    this.constraints = { ...DEFAULT_CONSTRAINTS, ...constraints };
    this.sandboxValidator = createSandboxValidator(config);

    // Initialize global configurations
    initializeSandboxConfig(config);

    // Set up event listeners for violation tracking
    this.setupViolationTracking();

    // Start background maintenance tasks
    this.startMaintenanceTasks();
  }

  /**
   * Execute any operation with comprehensive constraint enforcement
   */
  async executeWithConstraints<T>(
    operation: string,
    operationType: {
      sandbox?: SandboxedOperation;
      filesystem?: FileSystemOperation;
      idempotent?: IdempotentOperation;
    },
    executor: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    return constrainedOperation(
      operation,
      async () => {
        // Start sandbox tracking if applicable
        let sandboxOperationId: string | undefined;
        if (operationType.sandbox) {
          sandboxOperationId = this.sandboxValidator.startOperation(operationType.sandbox);
        }

        try {
          let result: T;

          // Apply idempotency validation if needed
          if (operationType.idempotent) {
            result = await withIdempotencyValidation(
              operationType.idempotent,
              { operation, metadata },
              executor,
            );
          } else {
            result = await executor();
          }

          // Validate result schema if it looks like API data
          if (this.isApiData(result)) {
            ensureLatestSchema(result);
          }

          return result;
        } finally {
          // End sandbox tracking
          if (operationType.sandbox && sandboxOperationId) {
            this.sandboxValidator.endOperation(operationType.sandbox, sandboxOperationId);
          }
        }
      },
      metadata,
    );
  }

  /**
   * Validate file operation with all relevant constraints
   */
  async validateFileOperation(
    operation: FileSystemOperation,
    filePaths: string[],
    operationId?: string,
  ): Promise<void> {
    for (const filePath of filePaths) {
      await globalFileSystemConstraints.validatePath(filePath, operation, operationId);
    }
  }

  /**
   * Export files with constraint enforcement
   */
  async exportWithConstraints(
    files: Record<string, string>,
    outputDir: string,
    format?: string,
  ): Promise<void> {
    const operationId = globalConstraintEnforcer.startOperation("constrained_export", {
      fileCount: Object.keys(files).length,
      outputDir,
      format,
    });

    try {
      // Validate payload sizes
      for (const [_path, content] of Object.entries(files)) {
        globalConstraintEnforcer.validatePayloadSize(content, operationId);
      }

      // Use file system constraints for export
      await globalFileSystemConstraints.exportFiles(files, outputDir, operationId);

      // Ensure all outputs use latest schema if they contain API data
      for (const [_path, content] of Object.entries(files)) {
        try {
          const parsed = JSON.parse(content);
          if (this.isApiData(parsed)) {
            ensureLatestSchema(parsed);
          }
        } catch {
          // Not JSON, skip schema validation
        }
      }
    } finally {
      globalConstraintEnforcer.endOperation(operationId);
    }
  }

  /**
   * Bundle files with constraint enforcement
   */
  async bundleWithConstraints(files: string[], outputDir: string): Promise<void> {
    const operationId = globalConstraintEnforcer.startOperation("constrained_bundle", {
      fileCount: files.length,
      outputDir,
    });

    try {
      // Validate all file paths first
      await this.validateFileOperation("bundle", files, operationId);

      // Use standalone copy bundling (no symlinks)
      await bundleStandalone(files, outputDir, operationId);
    } finally {
      globalConstraintEnforcer.endOperation(operationId);
    }
  }

  /**
   * Validate API response with schema and payload constraints
   */
  validateApiResponse(data: unknown, operationId?: string): unknown {
    // Validate payload size
    globalConstraintEnforcer.validatePayloadSize(data, operationId);

    // Validate schema for read operations
    if (this.isApiData(data)) {
      return validateReadData(data, operationId);
    }

    return data;
  }

  /**
   * Get comprehensive constraint system status
   */
  getSystemStatus(): ConstraintSystemStatus {
    const _constraintStatus = globalConstraintEnforcer.getConstraintStatus();
    const sandboxStatus = this.sandboxValidator.getSandboxStatus();
    const fsStatus = globalFileSystemConstraints.getConstraintStatus();
    const idempotencyStats = globalIdempotencyValidator.getValidationStats();

    const totalViolations = Array.from(this.violationCounts.values()).reduce((a, b) => a + b, 0);
    const complianceRate = totalViolations > 0 ? Math.max(0, 100 - totalViolations * 10) : 100;

    return {
      isHealthy: totalViolations === 0 && complianceRate > 95,
      constraints: this.constraints,
      violations: {
        totalViolations,
        byConstraint: Object.fromEntries(this.violationCounts),
        criticalViolations: this.getCriticalViolations(),
        suggestions: this.getImprovementSuggestions(),
        complianceRate,
      },
      sandbox: {
        activeOperations: sandboxStatus.activeOperations.length,
        complianceRate: sandboxStatus.complianceRate,
      },
      fileSystem: {
        symlinks: fsStatus.violations.symlinks,
        invalidPaths: fsStatus.violations.invalidPaths,
      },
      idempotency: {
        cacheSize: idempotencyStats.cacheSize,
        validations: idempotencyStats.validations,
      },
      schema: {
        latestVersion: LATEST_API_VERSION,
        deprecatedWarnings: 0, // Would be tracked via events
      },
    };
  }

  /**
   * Generate constraint compliance report
   */
  generateComplianceReport(): string {
    const status = this.getSystemStatus();
    const lines: string[] = [];

    lines.push(chalk.bold("🛡️  Constraint System Status"));
    lines.push("");

    // Overall health
    const healthColor = status.isHealthy ? chalk.green : chalk.red;
    const healthStatus = status.isHealthy ? "HEALTHY" : "VIOLATIONS DETECTED";
    lines.push(`Overall Status: ${healthColor(healthStatus)}`);
    lines.push(`Compliance Rate: ${this.formatComplianceRate(status.violations.complianceRate)}`);
    lines.push("");

    // Constraint details
    lines.push(chalk.bold("Constraint Limits:"));
    lines.push(`  Max Payload Size: ${this.formatBytes(status.constraints.maxPayloadSize)}`);
    lines.push(`  Max Operation Time: ${status.constraints.maxOperationTime}ms`);
    lines.push(
      `  Rate Limit: ${status.constraints.rateLimit.requests} req/${status.constraints.rateLimit.windowMs}ms`,
    );
    lines.push(`  API Version: ${status.constraints.apiVersion}`);
    lines.push(`  Symlink Depth: ${status.constraints.maxSymlinkDepth} (symlinks forbidden)`);
    lines.push("");

    // Violations
    if (status.violations.totalViolations > 0) {
      lines.push(chalk.bold(chalk.red("Violations:")));
      for (const [constraint, count] of Object.entries(status.violations.byConstraint)) {
        if (count > 0) {
          lines.push(`  ${chalk.red("✗")} ${constraint}: ${count} violations`);
        }
      }

      if (status.violations.criticalViolations.length > 0) {
        lines.push("");
        lines.push(chalk.bold(chalk.red("Critical Issues:")));
        for (const critical of status.violations.criticalViolations) {
          lines.push(`  ${chalk.red("⚠")} ${critical}`);
        }
      }

      lines.push("");
      lines.push(chalk.bold("Suggestions:"));
      for (const suggestion of status.violations.suggestions) {
        lines.push(`  ${chalk.yellow("💡")} ${suggestion}`);
      }
    } else {
      lines.push(chalk.green("✅ No constraint violations detected"));
    }

    lines.push("");

    // Component status
    lines.push(chalk.bold("Component Status:"));
    lines.push(
      `  Sandbox: ${status.sandbox.activeOperations} active ops, ${status.sandbox.complianceRate.toFixed(1)}% compliant`,
    );
    lines.push(
      `  File System: ${status.fileSystem.symlinks} symlinks, ${status.fileSystem.invalidPaths} invalid paths`,
    );
    lines.push(
      `  Idempotency: ${status.idempotency.cacheSize} cached, ${status.idempotency.validations} validated`,
    );
    lines.push(
      `  Schema: version ${status.schema.latestVersion}, ${status.schema.deprecatedWarnings} warnings`,
    );

    return lines.join("\n");
  }

  /**
   * Cleanup and shutdown constraint system
   */
  async shutdown(): Promise<void> {
    // Clear idempotency cache
    globalIdempotencyValidator.clearExpiredCache();

    // Remove all listeners
    this.removeAllListeners();
    globalConstraintEnforcer.removeAllListeners();

    this.emit("constraint_system:shutdown");
  }

  /**
   * Set up violation tracking across all constraint modules
   */
  private setupViolationTracking(): void {
    // Track violations from core enforcer
    globalConstraintEnforcer.on("constraint:violation", (event) => {
      this.incrementViolationCount(event.constraint);
      this.emit("violation", {
        constraint: event.constraint,
        violation: event.violation,
        timestamp: Date.now(),
      });
    });

    // Track sandbox violations
    this.sandboxValidator.on?.("constraint:violation", (_event) => {
      this.incrementViolationCount("sandboxCompliance");
    });

    // Track performance violations
    globalConstraintEnforcer.on("operation:end", (event) => {
      if (event.duration > this.constraints.maxOperationTime) {
        this.incrementViolationCount("maxOperationTime");
      }
    });
  }

  /**
   * Start background maintenance tasks
   */
  private startMaintenanceTasks(): void {
    // Clean up expired idempotency cache every 5 minutes
    setInterval(
      () => {
        globalIdempotencyValidator.clearExpiredCache();
      },
      5 * 60 * 1000,
    );

    // Reset violation counts daily
    setInterval(
      () => {
        this.violationCounts.clear();
        this.emit("violation_counts:reset");
      },
      24 * 60 * 60 * 1000,
    );
  }

  /**
   * Check if data looks like API envelope data
   */
  private isApiData(data: unknown): data is Record<string, unknown> {
    return typeof data === "object" && data !== null && "apiVersion" in data && "kind" in data;
  }

  /**
   * Increment violation count for a constraint
   */
  private incrementViolationCount(constraint: string): void {
    const current = this.violationCounts.get(constraint) || 0;
    this.violationCounts.set(constraint, current + 1);
  }

  /**
   * Get critical violations that need immediate attention
   */
  private getCriticalViolations(): string[] {
    const critical: string[] = [];

    for (const [constraint, count] of this.violationCounts.entries()) {
      if (count > 0) {
        switch (constraint) {
          case "maxPayloadSize":
            critical.push("Payload size limits exceeded - requests/responses too large");
            break;
          case "maxOperationTime":
            critical.push("Operations taking too long - performance issues detected");
            break;
          case "sandboxCompliance":
            critical.push("Direct tool execution detected - must use server endpoints");
            break;
          case "symlinkPrevention":
            critical.push("Symlinks detected - must use standalone file copies");
            break;
          case "apiVersion":
            critical.push("Outdated API versions in use - must use latest schema");
            break;
          case "idempotency":
            critical.push("Non-idempotent operations detected - results are inconsistent");
            break;
        }
      }
    }

    return critical;
  }

  /**
   * Get improvement suggestions based on violations
   */
  private getImprovementSuggestions(): string[] {
    const suggestions: string[] = [];

    for (const [constraint, count] of this.violationCounts.entries()) {
      if (count > 0) {
        switch (constraint) {
          case "maxPayloadSize":
            suggestions.push("Consider pagination or compression for large datasets");
            break;
          case "maxOperationTime":
            suggestions.push("Optimize algorithms or implement caching for better performance");
            break;
          case "rateLimit":
            suggestions.push("Implement request queuing or batch operations");
            break;
          case "sandboxCompliance":
            suggestions.push(
              "Ensure all analyze/validate operations use API client instead of direct tools",
            );
            break;
          case "symlinkPrevention":
            suggestions.push("Use file copying utilities that create standalone copies");
            break;
          case "apiVersion":
            suggestions.push(`Update all schemas to use API version ${LATEST_API_VERSION}`);
            break;
        }
      }
    }

    return suggestions;
  }

  /**
   * Format compliance rate with appropriate colors
   */
  private formatComplianceRate(rate: number): string {
    if (rate >= 95) return chalk.green(`${rate.toFixed(1)}%`);
    if (rate >= 80) return chalk.yellow(`${rate.toFixed(1)}%`);
    return chalk.red(`${rate.toFixed(1)}%`);
  }

  /**
   * Format bytes in human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  }
}

// Export all constraint components and utilities
export {
  // Core
  globalConstraintEnforcer,
  constrainedOperation,
  ConstraintViolationError,
  DEFAULT_CONSTRAINTS,
  type Constraints,
  // Sandbox
  createSandboxValidator,
  initializeSandboxConfig,
  type SandboxedOperation,
  type SandboxValidator,
  // Schema
  globalSchemaValidator,
  ensureLatestSchema,
  validateReadData,
  LATEST_API_VERSION,
  // File System
  globalFileSystemConstraints,
  copyStandalone,
  bundleStandalone,
  safeFileOperation,
  type FileSystemOperation,
  // Idempotency
  globalIdempotencyValidator,
  withIdempotencyValidation,
  validateIdempotentEdits,
  type IdempotentOperation,
};

/**
 * Create and initialize constraint system for CLI
 */
export function createConstraintSystem(
  config: CLIConfig,
  constraints?: Partial<Constraints>,
): ConstraintSystem {
  return new ConstraintSystem(config, constraints);
}

/**
 * Global constraint system instance (initialized by CLI)
 */
let globalConstraintSystem: ConstraintSystem | null = null;

/**
 * Initialize global constraint system
 */
export function initializeGlobalConstraintSystem(
  config: CLIConfig,
  constraints?: Partial<Constraints>,
): ConstraintSystem {
  globalConstraintSystem = new ConstraintSystem(config, constraints);
  return globalConstraintSystem;
}

/**
 * Get global constraint system (throws if not initialized)
 */
export function getGlobalConstraintSystem(): ConstraintSystem {
  if (!globalConstraintSystem) {
    throw new Error(
      "Constraint system not initialized. Call initializeGlobalConstraintSystem first.",
    );
  }
  return globalConstraintSystem;
}
