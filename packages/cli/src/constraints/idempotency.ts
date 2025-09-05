import { createHash } from "node:crypto";
import { ConstraintViolationError, globalConstraintEnforcer } from "./core.js";

/**
 * Operation types that must be idempotent
 */
export type IdempotentOperation =
  | "validate"
  | "export"
  | "transform"
  | "analyze"
  | "generate"
  | "bundle"
  | "diff"
  | "migrate";

/**
 * Idempotency cache entry
 */
interface IdempotencyRecord {
  operation: string;
  inputHash: string;
  outputHash: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

/**
 * Idempotency validation options
 */
interface IdempotencyOptions {
  /** Maximum cache age in milliseconds */
  maxCacheAge?: number;
  /** Whether to ignore timestamp differences in comparison */
  ignoreTimestamps?: boolean;
  /** Custom comparison function */
  customComparator?: (a: unknown, b: unknown) => boolean;
}

/**
 * Idempotent operation validator
 * Implements "Don't generate non-idempotent edits" constraint
 */
export class IdempotencyValidator {
  private readonly cache = new Map<string, IdempotencyRecord>();
  private readonly defaultOptions: Required<IdempotencyOptions> = {
    maxCacheAge: 5 * 60 * 1000, // 5 minutes
    ignoreTimestamps: true,
    customComparator: this.defaultComparator.bind(this),
  };

  /**
   * Validate that an operation produces idempotent results
   */
  async validateIdempotency<TInput, TOutput>(
    operation: IdempotentOperation,
    inputs: TInput,
    executor: (inputs: TInput) => Promise<TOutput>,
    options: IdempotencyOptions = {},
    operationId?: string,
  ): Promise<TOutput> {
    const opts = { ...this.defaultOptions, ...options };
    const cacheKey = this.generateCacheKey(operation, inputs);

    // Check if we have a cached result
    const cached = this.cache.get(cacheKey);

    if (cached && this.isCacheValid(cached, opts.maxCacheAge)) {
      // Execute operation again to verify idempotency
      const newResult = await executor(inputs);
      const newOutputHash = this.hashValue(newResult);

      // Compare results
      if (cached.outputHash !== newOutputHash) {
        const violation = new ConstraintViolationError(
          "idempotency",
          `different output: ${newOutputHash}`,
          `consistent output: ${cached.outputHash}`,
          {
            operationId,
            operation,
            cacheKey,
            cachedTimestamp: cached.timestamp,
            currentTimestamp: Date.now(),
            inputHash: cached.inputHash,
          },
        );

        globalConstraintEnforcer.emit("constraint:violation", {
          constraint: "idempotency",
          violation,
          operation,
        });

        throw violation;
      }

      globalConstraintEnforcer.emit("idempotency:verified", {
        operationId,
        operation,
        cacheKey,
        consistent: true,
      });

      return newResult;
    }

    // Execute operation for the first time (or cache expired)
    const result = await executor(inputs);

    // Cache the result
    const record: IdempotencyRecord = {
      operation,
      inputHash: this.hashValue(inputs),
      outputHash: this.hashValue(result),
      timestamp: Date.now(),
      metadata: {
        operationId,
        inputType: typeof inputs,
        outputType: typeof result,
      },
    };

    this.cache.set(cacheKey, record);

    // If this is a repeated execution, verify against previous result
    if (cached) {
      const violation = new ConstraintViolationError(
        "idempotency",
        "cache expired but results differ",
        "consistent results across time",
        {
          operationId,
          operation,
          cacheKey,
          previousHash: cached.outputHash,
          currentHash: record.outputHash,
        },
      );

      globalConstraintEnforcer.emit("constraint:violation", {
        constraint: "idempotency",
        violation,
        operation,
      });
    }

    globalConstraintEnforcer.emit("idempotency:cached", {
      operationId,
      operation,
      cacheKey,
      inputHash: record.inputHash,
      outputHash: record.outputHash,
    });

    return result;
  }

  /**
   * Validate that repeated execution produces identical results
   */
  async validateRepeatedExecution<TInput, TOutput>(
    operation: IdempotentOperation,
    inputs: TInput,
    executor: (inputs: TInput) => Promise<TOutput>,
    repetitions: number = 2,
    operationId?: string,
  ): Promise<TOutput> {
    if (repetitions < 2) {
      throw new Error("Repetitions must be at least 2 for idempotency validation");
    }

    const results: TOutput[] = [];
    const hashes: string[] = [];

    // Execute operation multiple times
    for (let i = 0; i < repetitions; i++) {
      const iterationId = globalConstraintEnforcer.startOperation(`${operation}:repeat:${i}`, {
        operationId,
        iteration: i,
        totalRepetitions: repetitions,
      });

      try {
        const result = await executor(inputs);
        const resultHash = this.hashValue(result);

        results.push(result);
        hashes.push(resultHash);

        globalConstraintEnforcer.endOperation(iterationId);
      } catch (error) {
        globalConstraintEnforcer.endOperation(iterationId);
        throw error;
      }
    }

    // Verify all results are identical
    const firstHash = hashes[0];
    for (let i = 1; i < hashes.length; i++) {
      if (hashes[i] !== firstHash) {
        const violation = new ConstraintViolationError(
          "idempotency",
          `iteration ${i} hash: ${hashes[i]}`,
          `consistent hash: ${firstHash}`,
          {
            operationId,
            operation,
            repetitions,
            allHashes: hashes,
            divergentIteration: i,
          },
        );

        globalConstraintEnforcer.emit("constraint:violation", {
          constraint: "idempotency",
          violation,
          operation,
        });

        throw violation;
      }
    }

    globalConstraintEnforcer.emit("idempotency:repeated_validated", {
      operationId,
      operation,
      repetitions,
      consistent: true,
      resultHash: firstHash,
    });

    return results[0];
  }

  /**
   * Track edit operations to ensure they produce idempotent results
   */
  async validateEditIdempotency<TInput, TEdit>(
    operation: IdempotentOperation,
    baseContent: TInput,
    editFunction: (content: TInput) => Promise<TEdit>,
    applyEdit: (content: TInput, edit: TEdit) => Promise<TInput>,
    operationId?: string,
  ): Promise<{ finalContent: TInput; edit: TEdit }> {
    // Generate edit
    const edit = await editFunction(baseContent);

    // Apply edit to get result
    const editedContent = await applyEdit(baseContent, edit);

    // Re-apply the same edit to verify idempotency
    const secondEdit = await editFunction(baseContent);
    const secondEditedContent = await applyEdit(baseContent, secondEdit);

    // Compare edit operations
    const editHash1 = this.hashValue(edit);
    const editHash2 = this.hashValue(secondEdit);

    if (editHash1 !== editHash2) {
      const violation = new ConstraintViolationError(
        "idempotency",
        `non-deterministic edit generation`,
        `consistent edit operations`,
        {
          operationId,
          operation,
          firstEditHash: editHash1,
          secondEditHash: editHash2,
          baseContentHash: this.hashValue(baseContent),
        },
      );

      globalConstraintEnforcer.emit("constraint:violation", {
        constraint: "idempotency",
        violation,
        operation,
      });

      throw violation;
    }

    // Compare final results
    const resultHash1 = this.hashValue(editedContent);
    const resultHash2 = this.hashValue(secondEditedContent);

    if (resultHash1 !== resultHash2) {
      const violation = new ConstraintViolationError(
        "idempotency",
        `non-deterministic edit application`,
        `consistent edit results`,
        {
          operationId,
          operation,
          firstResultHash: resultHash1,
          secondResultHash: resultHash2,
          editHash: editHash1,
        },
      );

      globalConstraintEnforcer.emit("constraint:violation", {
        constraint: "idempotency",
        violation,
        operation,
      });

      throw violation;
    }

    globalConstraintEnforcer.emit("idempotency:edit_validated", {
      operationId,
      operation,
      editHash: editHash1,
      resultHash: resultHash1,
      consistent: true,
    });

    return { finalContent: editedContent, edit };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): number {
    const _now = Date.now();
    let cleared = 0;

    for (const [key, record] of this.cache.entries()) {
      if (!this.isCacheValid(record, this.defaultOptions.maxCacheAge)) {
        this.cache.delete(key);
        cleared++;
      }
    }

    globalConstraintEnforcer.emit("idempotency:cache_cleared", {
      entriesCleared: cleared,
      remainingEntries: this.cache.size,
    });

    return cleared;
  }

  /**
   * Get idempotency validation statistics
   */
  getValidationStats(): {
    cacheSize: number;
    validations: number;
    violations: number;
    cacheHitRate: number;
  } {
    return {
      cacheSize: this.cache.size,
      validations: 0, // Would be tracked via event listeners
      violations: 0, // Would be tracked via event listeners
      cacheHitRate: 0, // Would be calculated from event data
    };
  }

  /**
   * Generate cache key for operation and inputs
   */
  private generateCacheKey<T>(operation: string, inputs: T): string {
    const inputHash = this.hashValue(inputs);
    return `${operation}:${inputHash}`;
  }

  /**
   * Hash any value for consistent comparison
   */
  private hashValue(value: unknown): string {
    let serialized: string;

    if (typeof value === "string") {
      serialized = value;
    } else if (Buffer.isBuffer(value)) {
      serialized = value.toString("base64");
    } else {
      // Normalize object for consistent hashing
      serialized = JSON.stringify(this.normalizeForHashing(value));
    }

    return createHash("sha256").update(serialized, "utf8").digest("hex");
  }

  /**
   * Normalize value for consistent hashing (sort keys, handle timestamps)
   */
  private normalizeForHashing(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeForHashing(item));
    }

    if (value instanceof Date) {
      // Optionally ignore timestamps for idempotency
      return this.defaultOptions.ignoreTimestamps ? "[TIMESTAMP]" : value.toISOString();
    }

    const obj = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    // Sort keys for consistent ordering
    const sortedKeys = Object.keys(obj).sort();

    for (const key of sortedKeys) {
      // Skip timestamp fields if configured to ignore them
      if (this.defaultOptions.ignoreTimestamps && this.isTimestampField(key)) {
        normalized[key] = "[TIMESTAMP]";
      } else {
        normalized[key] = this.normalizeForHashing(obj[key]);
      }
    }

    return normalized;
  }

  /**
   * Check if a field name represents a timestamp
   */
  private isTimestampField(fieldName: string): boolean {
    const timestampFields = [
      "timestamp",
      "createdAt",
      "updatedAt",
      "modifiedAt",
      "date",
      "time",
      "created_at",
      "updated_at",
      "modified_at",
      "processed_at",
    ];

    return timestampFields.includes(fieldName.toLowerCase());
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(record: IdempotencyRecord, maxAge: number): boolean {
    return Date.now() - record.timestamp <= maxAge;
  }

  /**
   * Default comparison function
   */
  private defaultComparator(a: unknown, b: unknown): boolean {
    return this.hashValue(a) === this.hashValue(b);
  }
}

/**
 * Global idempotency validator instance
 */
export const globalIdempotencyValidator = new IdempotencyValidator();

/**
 * Decorator for automatic idempotency validation
 */
export function idempotent(operation: IdempotentOperation, options: IdempotencyOptions = {}) {
  return <T extends (...args: any[]) => Promise<any>>(
    _target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>,
  ) => {
    const method = descriptor.value!;

    descriptor.value = async function (this: any, ...args: any[]) {
      const operationId = globalConstraintEnforcer.startOperation(`idempotent:${operation}`, {
        method: propertyName,
        args: args.length,
      });

      try {
        const result = await globalIdempotencyValidator.validateIdempotency(
          operation,
          args, // Use args as inputs
          async () => method.apply(this, args),
          options,
          operationId,
        );

        globalConstraintEnforcer.endOperation(operationId);
        return result;
      } catch (error) {
        globalConstraintEnforcer.endOperation(operationId);
        throw error;
      }
    } as T;

    return descriptor;
  };
}

/**
 * Utility function to wrap any operation with idempotency validation
 */
export async function withIdempotencyValidation<TInput, TOutput>(
  operation: IdempotentOperation,
  inputs: TInput,
  executor: (inputs: TInput) => Promise<TOutput>,
  options: IdempotencyOptions = {},
): Promise<TOutput> {
  return globalIdempotencyValidator.validateIdempotency(operation, inputs, executor, options);
}

/**
 * Utility for validating edit operations are idempotent
 */
export async function validateIdempotentEdits<TContent, TEdit>(
  operation: IdempotentOperation,
  baseContent: TContent,
  editFunction: (content: TContent) => Promise<TEdit>,
  applyEdit: (content: TContent, edit: TEdit) => Promise<TContent>,
): Promise<{ finalContent: TContent; edit: TEdit }> {
  return globalIdempotencyValidator.validateEditIdempotency(
    operation,
    baseContent,
    editFunction,
    applyEdit,
  );
}
