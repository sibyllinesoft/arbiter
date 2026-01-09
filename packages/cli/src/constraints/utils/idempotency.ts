import path from "node:path";
import { ConstraintViolationError, globalConstraintEnforcer } from "@/constraints/core/core.js";
import {
  buildCacheKeyFromRecord,
  generateCacheKey,
  hashValue,
} from "@/constraints/utils/idempotency-utils.js";
import fs from "fs-extra";

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
  private readonly cacheDir: string;
  private readonly cacheFile: string;
  private readonly defaultOptions: Required<IdempotencyOptions> = {
    maxCacheAge: 5 * 60 * 1000, // 5 minutes
    ignoreTimestamps: true,
    customComparator: this.defaultComparator.bind(this),
  };
  private cacheDirty = false;

  constructor(projectRoot = process.cwd()) {
    this.cacheDir = path.resolve(projectRoot, ".arbiter", "cache");
    this.cacheFile = path.join(this.cacheDir, "idempotency.json");
    this.loadCacheFromDisk();
  }

  /**
   * Load cached idempotency records from disk so validation persists across CLI invocations.
   */
  private loadCacheFromDisk(): void {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        return;
      }

      const raw = fs.readFileSync(this.cacheFile, "utf8");
      const parsed = JSON.parse(raw) as { records?: IdempotencyRecord[] };
      const records = Array.isArray(parsed.records) ? parsed.records : [];

      this.cache.clear();
      for (const record of records) {
        this.cache.set(buildCacheKeyFromRecord(record), record);
      }
    } catch (error) {
      // Soft-fail: corrupted cache should not break the CLI
      console.warn("⚠️  Unable to read idempotency cache, starting fresh.", error);
    }
  }

  /**
   * Persist cache state to disk when it changes.
   */
  private persistCache(): void {
    try {
      if (!this.cacheDirty) return;

      fs.ensureDirSync(this.cacheDir);
      const payload = {
        version: 1,
        records: Array.from(this.cache.values()),
        updatedAt: new Date().toISOString(),
      };
      fs.writeJsonSync(this.cacheFile, payload, { spaces: 2 });
      this.cacheDirty = false;
    } catch (error) {
      console.warn("⚠️  Unable to persist idempotency cache to disk.", error);
    }
  }

  /**
   * Drop expired cache entries before using them to avoid stale validations.
   */
  private pruneCache(maxAge: number): void {
    let removed = 0;

    for (const [key, record] of this.cache.entries()) {
      if (!this.isCacheValid(record, maxAge)) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.cacheDirty = true;
      this.persistCache();
    }
  }

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
    this.pruneCache(opts.maxCacheAge);

    const cacheKey = generateCacheKey(operation, inputs, opts.ignoreTimestamps);
    const cached = this.cache.get(cacheKey);

    if (cached && this.isCacheValid(cached, opts.maxCacheAge)) {
      return await this.validateCachedResult(
        cached,
        executor,
        inputs,
        operation,
        operationId,
        cacheKey,
      );
    }

    return await this.executeAndCacheOperation(
      operation,
      inputs,
      executor,
      operationId,
      cacheKey,
      cached,
    );
  }

  /**
   * Validate cached result by re-executing operation and comparing outputs
   */
  private async validateCachedResult<TInput, TOutput>(
    cached: IdempotencyRecord,
    executor: (inputs: TInput) => Promise<TOutput>,
    inputs: TInput,
    operation: IdempotentOperation,
    operationId?: string,
    cacheKey?: string,
  ): Promise<TOutput> {
    const newResult = await executor(inputs);
    const newOutputHash = hashValue(newResult, this.defaultOptions.ignoreTimestamps);

    if (cached.outputHash !== newOutputHash) {
      this.throwIdempotencyViolation("different output", newOutputHash, cached.outputHash, {
        operationId,
        operation,
        cacheKey,
        cachedTimestamp: cached.timestamp,
        currentTimestamp: Date.now(),
        inputHash: cached.inputHash,
      });
    }

    this.emitIdempotencyVerified(operationId, operation, cacheKey);
    return newResult;
  }

  /**
   * Execute operation and cache the result
   */
  private async executeAndCacheOperation<TInput, TOutput>(
    operation: IdempotentOperation,
    inputs: TInput,
    executor: (inputs: TInput) => Promise<TOutput>,
    operationId?: string,
    cacheKey?: string,
    cached?: IdempotencyRecord,
  ): Promise<TOutput> {
    const result = await executor(inputs);
    const record = this.createCacheRecord(operation, inputs, result, operationId);

    this.cache.set(cacheKey!, record);
    this.cacheDirty = true;
    this.handleExpiredCacheValidation(cached, record, operation, operationId, cacheKey);
    this.emitCacheEvent(operationId, operation, cacheKey, record);
    this.persistCache();

    return result;
  }

  /**
   * Create cache record for storing operation result
   */
  private createCacheRecord<TInput, TOutput>(
    operation: IdempotentOperation,
    inputs: TInput,
    result: TOutput,
    operationId?: string,
  ): IdempotencyRecord {
    return {
      operation,
      inputHash: hashValue(inputs, this.defaultOptions.ignoreTimestamps),
      outputHash: hashValue(result, this.defaultOptions.ignoreTimestamps),
      timestamp: Date.now(),
      metadata: {
        operationId,
        inputType: typeof inputs,
        outputType: typeof result,
      },
    };
  }

  /**
   * Handle validation when cache was expired
   */
  private handleExpiredCacheValidation(
    cached: IdempotencyRecord | undefined,
    currentRecord: IdempotencyRecord,
    operation: IdempotentOperation,
    operationId?: string,
    cacheKey?: string,
  ): void {
    if (cached && cached.outputHash !== currentRecord.outputHash) {
      this.emitConstraintViolation(
        "cache expired but results differ",
        "consistent results across time",
        {
          operationId,
          operation,
          cacheKey,
          previousHash: cached.outputHash,
          currentHash: currentRecord.outputHash,
        },
      );
    }
  }

  /**
   * Throw idempotency violation with proper error structure
   */
  private throwIdempotencyViolation(
    message: string,
    actual: string,
    expected: string,
    metadata: Record<string, unknown>,
  ): never {
    const violation = new ConstraintViolationError(
      "idempotency",
      `${message}: ${actual}`,
      `consistent output: ${expected}`,
      metadata,
    );

    globalConstraintEnforcer.emit("constraint:violation", {
      constraint: "idempotency",
      violation,
      operation: metadata.operation,
    });

    throw violation;
  }

  /**
   * Emit constraint violation event
   */
  private emitConstraintViolation(
    message: string,
    expected: string,
    metadata: Record<string, unknown>,
  ): void {
    const violation = new ConstraintViolationError("idempotency", message, expected, metadata);

    globalConstraintEnforcer.emit("constraint:violation", {
      constraint: "idempotency",
      violation,
      operation: metadata.operation,
    });
  }

  /**
   * Emit idempotency verified event
   */
  private emitIdempotencyVerified(
    operationId?: string,
    operation?: IdempotentOperation,
    cacheKey?: string,
  ): void {
    globalConstraintEnforcer.emit("idempotency:verified", {
      operationId,
      operation,
      cacheKey,
      consistent: true,
    });
  }

  /**
   * Emit cache event for successful operation
   */
  private emitCacheEvent(
    operationId?: string,
    operation?: IdempotentOperation,
    cacheKey?: string,
    record?: IdempotencyRecord,
  ): void {
    globalConstraintEnforcer.emit("idempotency:cached", {
      operationId,
      operation,
      cacheKey,
      inputHash: record?.inputHash,
      outputHash: record?.outputHash,
    });
  }

  /**
   * Validate that repeated execution produces identical results
   */
  async validateRepeatedExecution<TInput, TOutput>(
    operation: IdempotentOperation,
    inputs: TInput,
    executor: (inputs: TInput) => Promise<TOutput>,
    repetitions = 2,
    operationId?: string,
  ): Promise<TOutput> {
    const validatedRepetitions = this.validateAndGetRepetitions(repetitions);
    const executionResults = await this.performRepeatedExecution(
      operation,
      inputs,
      executor,
      validatedRepetitions,
      operationId,
    );

    return this.processExecutionResults(
      executionResults,
      operation,
      validatedRepetitions,
      operationId,
    );
  }

  /**
   * Validate and return the repetition count
   */
  private validateAndGetRepetitions(repetitions: number): number {
    this.validateRepetitionCount(repetitions);
    return repetitions;
  }

  /**
   * Perform the repeated execution and collect results
   */
  private async performRepeatedExecution<TInput, TOutput>(
    operation: IdempotentOperation,
    inputs: TInput,
    executor: (inputs: TInput) => Promise<TOutput>,
    repetitions: number,
    operationId?: string,
  ): Promise<{ results: TOutput[]; hashes: string[] }> {
    return await this.executeRepeatedOperations(
      operation,
      inputs,
      executor,
      repetitions,
      operationId,
    );
  }

  /**
   * Process execution results and return the first result
   */
  private processExecutionResults<TOutput>(
    executionResults: { results: TOutput[]; hashes: string[] },
    operation: IdempotentOperation,
    repetitions: number,
    operationId?: string,
  ): TOutput {
    this.validateResultConsistency(executionResults.hashes, operation, repetitions, operationId);

    this.emitValidationSuccess(operation, repetitions, operationId, executionResults.hashes[0]);

    return executionResults.results[0];
  }

  /**
   * Validate repetition count is sufficient for testing
   */
  private validateRepetitionCount(repetitions: number): void {
    if (repetitions < 2) {
      throw new Error("Repetitions must be at least 2 for idempotency validation");
    }
  }

  /**
   * Execute operation multiple times and collect results
   */
  private async executeRepeatedOperations<TInput, TOutput>(
    operation: IdempotentOperation,
    inputs: TInput,
    executor: (inputs: TInput) => Promise<TOutput>,
    repetitions: number,
    operationId?: string,
  ): Promise<{ results: TOutput[]; hashes: string[] }> {
    const results: TOutput[] = [];
    const hashes: string[] = [];

    for (let i = 0; i < repetitions; i++) {
      const result = await this.executeSingleIteration(
        operation,
        inputs,
        executor,
        i,
        repetitions,
        operationId,
      );

      const resultHash = hashValue(result, this.defaultOptions.ignoreTimestamps);
      results.push(result);
      hashes.push(resultHash);
    }

    return { results, hashes };
  }

  /**
   * Execute a single iteration with proper error handling
   */
  private async executeSingleIteration<TInput, TOutput>(
    operation: IdempotentOperation,
    inputs: TInput,
    executor: (inputs: TInput) => Promise<TOutput>,
    iteration: number,
    totalRepetitions: number,
    operationId?: string,
  ): Promise<TOutput> {
    const iterationId = globalConstraintEnforcer.startOperation(
      `${operation}:repeat:${iteration}`,
      {
        operationId,
        iteration,
        totalRepetitions,
      },
    );

    try {
      const result = await executor(inputs);
      globalConstraintEnforcer.endOperation(iterationId);
      return result;
    } catch (error) {
      globalConstraintEnforcer.endOperation(iterationId);
      throw error;
    }
  }

  /**
   * Validate that all execution results are consistent
   */
  private validateResultConsistency(
    hashes: string[],
    operation: IdempotentOperation,
    repetitions: number,
    operationId?: string,
  ): void {
    const firstHash = hashes[0];

    for (let i = 1; i < hashes.length; i++) {
      if (hashes[i] !== firstHash) {
        this.handleInconsistentResult(i, hashes, firstHash, operation, repetitions, operationId);
      }
    }
  }

  /**
   * Handle inconsistent result by creating and throwing violation
   */
  private handleInconsistentResult(
    divergentIteration: number,
    allHashes: string[],
    expectedHash: string,
    operation: IdempotentOperation,
    repetitions: number,
    operationId?: string,
  ): never {
    const violation = new ConstraintViolationError(
      "idempotency",
      `iteration ${divergentIteration} hash: ${allHashes[divergentIteration]}`,
      `consistent hash: ${expectedHash}`,
      {
        operationId,
        operation,
        repetitions,
        allHashes,
        divergentIteration,
      },
    );

    globalConstraintEnforcer.emit("constraint:violation", {
      constraint: "idempotency",
      violation,
      operation,
    });

    throw violation;
  }

  /**
   * Emit success event for validated repeated execution
   */
  private emitValidationSuccess(
    operation: IdempotentOperation,
    repetitions: number,
    operationId: string | undefined,
    resultHash: string,
  ): void {
    globalConstraintEnforcer.emit("idempotency:repeated_validated", {
      operationId,
      operation,
      repetitions,
      consistent: true,
      resultHash,
    });
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
    const [edit, secondEdit] = await Promise.all([
      editFunction(baseContent),
      editFunction(baseContent),
    ]);
    const [editedContent, secondEditedContent] = await Promise.all([
      applyEdit(baseContent, edit),
      applyEdit(baseContent, secondEdit),
    ]);

    const editHash1 = hashValue(edit, this.defaultOptions.ignoreTimestamps);
    const editHash2 = hashValue(secondEdit, this.defaultOptions.ignoreTimestamps);
    this.validateEditConsistency(
      editHash1,
      editHash2,
      operation,
      operationId,
      hashValue(baseContent, this.defaultOptions.ignoreTimestamps),
    );

    const resultHash1 = hashValue(editedContent, this.defaultOptions.ignoreTimestamps);
    const resultHash2 = hashValue(secondEditedContent, this.defaultOptions.ignoreTimestamps);
    this.validateResultHashConsistency(resultHash1, resultHash2, operation, operationId, editHash1);

    globalConstraintEnforcer.emit("idempotency:edit_validated", {
      operationId,
      operation,
      editHash: editHash1,
      resultHash: resultHash1,
      consistent: true,
    });

    return { finalContent: editedContent, edit };
  }

  private validateEditConsistency(
    hash1: string,
    hash2: string,
    operation: IdempotentOperation,
    operationId?: string,
    baseContentHash?: string,
  ): void {
    if (hash1 === hash2) return;
    this.throwEditViolation("non-deterministic edit generation", "consistent edit operations", {
      operationId,
      operation,
      firstEditHash: hash1,
      secondEditHash: hash2,
      baseContentHash,
    });
  }

  private validateResultHashConsistency(
    hash1: string,
    hash2: string,
    operation: IdempotentOperation,
    operationId?: string,
    editHash?: string,
  ): void {
    if (hash1 === hash2) return;
    this.throwEditViolation("non-deterministic edit application", "consistent edit results", {
      operationId,
      operation,
      firstResultHash: hash1,
      secondResultHash: hash2,
      editHash,
    });
  }

  private throwEditViolation(
    message: string,
    expected: string,
    metadata: Record<string, unknown>,
  ): never {
    const violation = new ConstraintViolationError("idempotency", message, expected, metadata);
    globalConstraintEnforcer.emit("constraint:violation", {
      constraint: "idempotency",
      violation,
      operation: metadata.operation,
    });
    throw violation;
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

    if (cleared > 0) {
      this.cacheDirty = true;
      this.persistCache();
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
   * Check if cache entry is still valid
   */
  private isCacheValid(record: IdempotencyRecord, maxAge: number): boolean {
    return Date.now() - record.timestamp <= maxAge;
  }

  /**
   * Default comparison function
   */
  private defaultComparator(a: unknown, b: unknown): boolean {
    return (
      hashValue(a, this.defaultOptions.ignoreTimestamps) ===
      hashValue(b, this.defaultOptions.ignoreTimestamps)
    );
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
