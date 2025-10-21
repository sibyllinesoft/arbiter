import { z } from "zod";
import { ConstraintViolationError, globalConstraintEnforcer } from "./core.js";

/**
 * Latest API version - must be updated when schema changes
 * This enforces the "Don't write older schemas" constraint
 */
export const LATEST_API_VERSION = "2024-12-26";

/**
 * Version compatibility matrix
 * Defines which versions are compatible for reading/writing
 */
export const VERSION_COMPATIBILITY = {
  // Current version (write operations must use this)
  current: LATEST_API_VERSION,

  // Supported versions for read operations
  supported: [
    "2024-12-26",
    "2024-12-25", // Previous version for migration support
  ],

  // Deprecated versions (read-only, warn on usage)
  deprecated: ["2024-12-24", "2024-12-23"],

  // Unsupported versions (reject all operations)
  unsupported: ["2024-12-22", "2024-12-21"],
};

/**
 * Base envelope schema that all API responses must conform to
 */
export const envelopeBaseSchema = z.object({
  apiVersion: z
    .string()
    .refine(
      (version) =>
        VERSION_COMPATIBILITY.supported.includes(version) ||
        VERSION_COMPATIBILITY.deprecated.includes(version),
      {
        message: `API version must be one of: ${[...VERSION_COMPATIBILITY.supported, ...VERSION_COMPATIBILITY.deprecated].join(", ")}`,
      },
    ),
  kind: z.string(),
  metadata: z
    .object({
      name: z.string().optional(),
      createdAt: z.string().datetime().optional(),
      version: z.string().optional(),
      migrationNotes: z.string().optional(),
    })
    .optional(),
});

/**
 * Schema for validation results with version enforcement
 */
export const validationResultSchema = envelopeBaseSchema.extend({
  kind: z.literal("ValidationResult"),
  spec: z.object({
    success: z.boolean(),
    errors: z
      .array(
        z.object({
          line: z.number(),
          column: z.number(),
          message: z.string(),
          severity: z.enum(["error", "warning"]),
          category: z.string(),
        }),
      )
      .optional(),
    warnings: z
      .array(
        z.object({
          line: z.number(),
          column: z.number(),
          message: z.string(),
          category: z.string(),
        }),
      )
      .optional(),
  }),
});

/**
 * Schema for export results with version enforcement
 */
export const exportResultSchema = envelopeBaseSchema.extend({
  kind: z.literal("ExportResult"),
  spec: z.object({
    format: z.string(),
    content: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

/**
 * Schema for analysis results with version enforcement
 */
export const analysisResultSchema = envelopeBaseSchema.extend({
  kind: z.literal("AnalysisResult"),
  spec: z.object({
    summary: z.string(),
    issues: z
      .array(
        z.object({
          type: z.string(),
          severity: z.enum(["low", "medium", "high", "critical"]),
          message: z.string(),
          location: z
            .object({
              line: z.number(),
              column: z.number(),
            })
            .optional(),
        }),
      )
      .optional(),
    metrics: z.record(z.number()).optional(),
  }),
});

/**
 * Union type for all valid envelope schemas
 */
export const envelopeSchema = z.discriminatedUnion("kind", [
  validationResultSchema,
  exportResultSchema,
  analysisResultSchema,
]);

export type EnvelopeData = z.infer<typeof envelopeSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type ExportResult = z.infer<typeof exportResultSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/**
 * Schema version validator and enforcer
 */
export class SchemaVersionValidator {
  /**
   * Validate that data conforms to the latest envelope schema for write operations
   */
  validateWriteSchema(data: unknown, operationId?: string): EnvelopeData {
    // First validate that it has the correct structure
    const parseResult = envelopeSchema.safeParse(data);
    if (!parseResult.success) {
      const violation = new ConstraintViolationError(
        "schemaValidation",
        "invalid envelope structure",
        "valid envelope schema",
        {
          operationId,
          validationErrors: parseResult.error.errors,
          providedData: typeof data === "object" ? Object.keys(data as object) : typeof data,
        },
      );

      globalConstraintEnforcer.emit("constraint:violation", {
        constraint: "schemaValidation",
        violation,
        data,
      });

      throw violation;
    }

    const envelope = parseResult.data;

    // Enforce that write operations use the latest API version
    globalConstraintEnforcer.validateApiVersion(envelope.apiVersion, operationId);

    // Additional validation for specific envelope types
    this.validateEnvelopeContent(envelope, operationId);

    globalConstraintEnforcer.emit("schema:validated", {
      operationId,
      kind: envelope.kind,
      apiVersion: envelope.apiVersion,
    });

    return envelope;
  }

  /**
   * Validate envelope for read operations (more permissive)
   */
  validateReadSchema(data: unknown, operationId?: string): EnvelopeData {
    const parseResult = envelopeSchema.safeParse(data);
    if (!parseResult.success) {
      const violation = new ConstraintViolationError(
        "schemaValidation",
        "invalid envelope structure",
        "valid envelope schema",
        {
          operationId,
          validationErrors: parseResult.error.errors,
          providedData: typeof data === "object" ? Object.keys(data as object) : typeof data,
        },
      );

      globalConstraintEnforcer.emit("constraint:violation", {
        constraint: "schemaValidation",
        violation,
        data,
      });

      throw violation;
    }

    const envelope = parseResult.data;

    // Check version compatibility for read operations
    this.validateVersionCompatibility(envelope.apiVersion, "read", operationId);

    globalConstraintEnforcer.emit("schema:validated", {
      operationId,
      kind: envelope.kind,
      apiVersion: envelope.apiVersion,
      operation: "read",
    });

    return envelope;
  }

  /**
   * Create a new envelope with the latest API version
   */
  createEnvelope<T extends EnvelopeData>(
    kind: T["kind"],
    spec: T["spec"],
    metadata?: T["metadata"],
  ): T {
    const envelope = {
      apiVersion: LATEST_API_VERSION,
      kind,
      spec,
      metadata: {
        createdAt: new Date().toISOString(),
        ...metadata,
      },
    } as T;

    // Validate the created envelope
    this.validateWriteSchema(envelope);

    return envelope;
  }

  /**
   * Migrate an older envelope to the latest version
   */
  migrateToLatest(envelope: EnvelopeData, operationId?: string): EnvelopeData {
    if (envelope.apiVersion === LATEST_API_VERSION) {
      return envelope; // Already latest
    }

    // Check if migration is supported
    if (!this.isMigrationSupported(envelope.apiVersion)) {
      const violation = new ConstraintViolationError(
        "versionMigration",
        envelope.apiVersion,
        "supported version for migration",
        {
          operationId,
          currentVersion: envelope.apiVersion,
          latestVersion: LATEST_API_VERSION,
          supportedVersions: VERSION_COMPATIBILITY.supported,
        },
      );

      globalConstraintEnforcer.emit("constraint:violation", {
        constraint: "versionMigration",
        violation,
        envelope,
      });

      throw violation;
    }

    // Perform version migration
    const migrated = {
      ...envelope,
      apiVersion: LATEST_API_VERSION,
      metadata: {
        ...envelope.metadata,
        migratedFrom: envelope.apiVersion,
        migratedAt: new Date().toISOString(),
      },
    };

    // Apply version-specific migrations
    const fullyMigrated = this.applyVersionMigrations(migrated, envelope.apiVersion);

    globalConstraintEnforcer.emit("schema:migrated", {
      operationId,
      fromVersion: envelope.apiVersion,
      toVersion: LATEST_API_VERSION,
      kind: envelope.kind,
    });

    return fullyMigrated;
  }

  /**
   * Check if a version supports migration
   */
  private isMigrationSupported(version: string): boolean {
    return (
      VERSION_COMPATIBILITY.supported.includes(version) ||
      VERSION_COMPATIBILITY.deprecated.includes(version)
    );
  }

  /**
   * Validate version compatibility for different operations
   */
  private validateVersionCompatibility(
    version: string,
    operation: "read" | "write",
    operationId?: string,
  ): void {
    if (VERSION_COMPATIBILITY.unsupported.includes(version)) {
      const violation = new ConstraintViolationError(
        "versionCompatibility",
        version,
        "supported API version",
        {
          operationId,
          operation,
          version,
          supportedVersions: VERSION_COMPATIBILITY.supported,
          reason: "Version is no longer supported",
        },
      );

      globalConstraintEnforcer.emit("constraint:violation", {
        constraint: "versionCompatibility",
        violation,
        version,
      });

      throw violation;
    }

    if (operation === "write" && version !== LATEST_API_VERSION) {
      const violation = new ConstraintViolationError(
        "versionCompatibility",
        version,
        LATEST_API_VERSION,
        {
          operationId,
          operation,
          version,
          latestVersion: LATEST_API_VERSION,
          reason: "Write operations must use latest API version",
        },
      );

      globalConstraintEnforcer.emit("constraint:violation", {
        constraint: "versionCompatibility",
        violation,
        version,
      });

      throw violation;
    }

    // Warn about deprecated versions
    if (VERSION_COMPATIBILITY.deprecated.includes(version)) {
      globalConstraintEnforcer.emit("schema:deprecated_version", {
        operationId,
        version,
        latestVersion: LATEST_API_VERSION,
        message: `API version ${version} is deprecated. Please upgrade to ${LATEST_API_VERSION}`,
      });
    }
  }

  /**
   * Validate envelope content based on kind
   */
  private validateEnvelopeContent(envelope: EnvelopeData, operationId?: string): void {
    switch (envelope.kind) {
      case "ValidationResult":
        this.validateValidationResult(envelope, operationId);
        break;
      case "ExportResult":
        this.validateExportResult(envelope, operationId);
        break;
      case "AnalysisResult":
        this.validateAnalysisResult(envelope, operationId);
        break;
      default:
        // Extensibility for future envelope types
        break;
    }
  }

  /**
   * Apply version-specific migration logic
   */
  private applyVersionMigrations(envelope: EnvelopeData, fromVersion: string): EnvelopeData {
    let migrated = envelope;

    // Apply migrations in sequence based on version
    if (fromVersion === "2024-12-25") {
      migrated = this.migrateFrom20241225(migrated);
    }

    if (fromVersion === "2024-12-24") {
      migrated = this.migrateFrom20241224(migrated);
    }

    return migrated;
  }

  /**
   * Migration from version 2024-12-25 to latest
   */
  private migrateFrom20241225(envelope: EnvelopeData): EnvelopeData {
    // Add any specific migration logic here
    // For now, just update metadata
    return {
      ...envelope,
      metadata: {
        ...envelope.metadata,
        migrationNotes: "Migrated from 2024-12-25 - no structural changes required",
      },
    };
  }

  /**
   * Migration from version 2024-12-24 to latest
   */
  private migrateFrom20241224(envelope: EnvelopeData): EnvelopeData {
    // Add any specific migration logic here
    return {
      ...envelope,
      metadata: {
        ...envelope.metadata,
        migrationNotes: "Migrated from 2024-12-24 - deprecated fields removed",
      },
    };
  }

  private validateValidationResult(envelope: ValidationResult, operationId?: string): void {
    // Additional validation for ValidationResult envelopes
    if (!envelope.spec.success && (!envelope.spec.errors || envelope.spec.errors.length === 0)) {
      globalConstraintEnforcer.emit("schema:warning", {
        operationId,
        message: "ValidationResult marked as unsuccessful but no errors provided",
        envelope: envelope.kind,
      });
    }
  }

  private validateExportResult(envelope: ExportResult, operationId?: string): void {
    // Additional validation for ExportResult envelopes
    if (!envelope.spec.content || envelope.spec.content.trim() === "") {
      const violation = new ConstraintViolationError(
        "schemaValidation",
        "empty export content",
        "non-empty export content",
        {
          operationId,
          format: envelope.spec.format,
        },
      );

      throw violation;
    }
  }

  private validateAnalysisResult(envelope: AnalysisResult, operationId?: string): void {
    // Additional validation for AnalysisResult envelopes
    if (!envelope.spec.summary || envelope.spec.summary.trim() === "") {
      globalConstraintEnforcer.emit("schema:warning", {
        operationId,
        message: "AnalysisResult has empty summary",
        envelope: envelope.kind,
      });
    }
  }
}

/**
 * Global schema validator instance
 */
export const globalSchemaValidator = new SchemaVersionValidator();

/**
 * Utility function to ensure data is written with latest schema
 */
export function ensureLatestSchema<T extends EnvelopeData>(data: T, operationId?: string): T {
  return globalSchemaValidator.validateWriteSchema(data, operationId) as T;
}

/**
 * Utility function to validate read data with version compatibility
 */
export function validateReadData(data: unknown, operationId?: string): EnvelopeData {
  return globalSchemaValidator.validateReadSchema(data, operationId);
}

/**
 * Decorator to automatically enforce schema validation on API responses
 */
export function withSchemaValidation(operation: "read" | "write") {
  return <T extends (...args: any[]) => Promise<any>>(
    _target: any,
    _propertyName: string,
    descriptor: TypedPropertyDescriptor<T>,
  ) => {
    const method = descriptor.value!;

    descriptor.value = async function (this: any, ...args: any[]) {
      const result = await method.apply(this, args);

      // Validate the result based on operation type
      if (operation === "write") {
        return globalSchemaValidator.validateWriteSchema(result);
      }
      return globalSchemaValidator.validateReadSchema(result);
    } as T;

    return descriptor;
  };
}
