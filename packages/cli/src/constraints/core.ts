import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';

/**
 * Constraint violation error with specific failure details
 */
export class ConstraintViolationError extends Error {
  constructor(
    public readonly constraint: string,
    public readonly actual: unknown,
    public readonly expected: unknown,
    public readonly details?: Record<string, unknown>
  ) {
    super(`Constraint violation: ${constraint} - Expected ${expected}, got ${actual}`);
    this.name = 'ConstraintViolationError';
  }
}

/**
 * Core constraint types that must be enforced across all operations
 */
export interface Constraints {
  /** Maximum payload size in bytes (≤64 KB) */
  maxPayloadSize: number;
  /** Maximum operation duration in milliseconds (≤750 ms) */
  maxOperationTime: number;
  /** Rate limit in requests per second (~1 rps) */
  rateLimit: {
    requests: number;
    windowMs: number;
  };
  /** API version for schema validation */
  apiVersion: string;
  /** Maximum symlink depth (0 = no symlinks allowed) */
  maxSymlinkDepth: number;
}

/**
 * Default constraint values from TODO.md section 13
 */
export const DEFAULT_CONSTRAINTS: Constraints = {
  maxPayloadSize: 64 * 1024, // 64 KB
  maxOperationTime: 750, // 750 ms
  rateLimit: {
    requests: 1,
    windowMs: 1000, // 1 second window for ~1 rps
  },
  apiVersion: '2024-12-26', // Latest as of implementation
  maxSymlinkDepth: 0, // No symlinks allowed
};

/**
 * Operation context for tracking constraint violations
 */
export interface OperationContext {
  operation: string;
  startTime: number;
  payloadSize?: number;
  apiVersion?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Rate limiting state tracker
 */
interface RateLimitState {
  requests: number;
  windowStart: number;
}

/**
 * Constraint monitoring and enforcement system
 * Implements fail-fast behavior with real-time violation detection
 */
export class ConstraintEnforcer extends EventEmitter {
  private readonly constraints: Constraints;
  private readonly rateLimitState: RateLimitState;
  private readonly operations = new Map<string, OperationContext>();

  constructor(constraints: Partial<Constraints> = {}) {
    super();
    this.constraints = { ...DEFAULT_CONSTRAINTS, ...constraints };
    this.rateLimitState = {
      requests: 0,
      windowStart: Date.now(),
    };
  }

  /**
   * Start tracking an operation for constraint enforcement
   */
  startOperation(operation: string, metadata?: Record<string, unknown>): string {
    const operationId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const context: OperationContext = {
      operation,
      startTime: performance.now(),
      metadata,
    };

    this.operations.set(operationId, context);

    // Check rate limiting before operation starts
    this.enforceRateLimit();

    this.emit('operation:start', { operationId, context });
    return operationId;
  }

  /**
   * End tracking an operation and enforce time constraints
   */
  endOperation(operationId: string): void {
    const context = this.operations.get(operationId);
    if (!context) {
      throw new Error(`Operation ${operationId} not found`);
    }

    const duration = performance.now() - context.startTime;

    // Enforce maximum operation time
    if (duration > this.constraints.maxOperationTime) {
      const violation = new ConstraintViolationError(
        'maxOperationTime',
        `${Math.round(duration)}ms`,
        `≤${this.constraints.maxOperationTime}ms`,
        {
          operationId,
          operation: context.operation,
          duration,
          metadata: context.metadata,
        }
      );

      this.emit('constraint:violation', {
        constraint: 'maxOperationTime',
        violation,
        context,
      });

      throw violation;
    }

    this.operations.delete(operationId);
    this.emit('operation:end', { operationId, duration, context });
  }

  /**
   * Validate payload size constraint
   */
  validatePayloadSize(data: unknown, operationId?: string): void {
    const payloadSize = this.calculatePayloadSize(data);

    if (payloadSize > this.constraints.maxPayloadSize) {
      const violation = new ConstraintViolationError(
        'maxPayloadSize',
        `${this.formatBytes(payloadSize)}`,
        `≤${this.formatBytes(this.constraints.maxPayloadSize)}`,
        {
          operationId,
          payloadSize,
          dataType: typeof data,
        }
      );

      this.emit('constraint:violation', {
        constraint: 'maxPayloadSize',
        violation,
        payloadSize,
      });

      throw violation;
    }

    // Update operation context with payload size
    if (operationId) {
      const context = this.operations.get(operationId);
      if (context) {
        context.payloadSize = payloadSize;
      }
    }

    this.emit('payload:validated', { operationId, payloadSize });
  }

  /**
   * Validate API version constraint (must use latest)
   */
  validateApiVersion(version: string, operationId?: string): void {
    if (version !== this.constraints.apiVersion) {
      const violation = new ConstraintViolationError(
        'apiVersion',
        version,
        this.constraints.apiVersion,
        {
          operationId,
          message: 'Must use latest API version in envelope schema',
        }
      );

      this.emit('constraint:violation', {
        constraint: 'apiVersion',
        violation,
        providedVersion: version,
      });

      throw violation;
    }

    // Update operation context with API version
    if (operationId) {
      const context = this.operations.get(operationId);
      if (context) {
        context.apiVersion = version;
      }
    }

    this.emit('apiVersion:validated', { operationId, version });
  }

  /**
   * Validate that operation uses server endpoints (sandbox constraint)
   */
  validateSandboxCompliance(
    operationType: string,
    isDirectToolExecution: boolean,
    operationId?: string
  ): void {
    if (isDirectToolExecution) {
      const violation = new ConstraintViolationError(
        'sandboxCompliance',
        'direct tool execution',
        'server endpoint usage',
        {
          operationId,
          operationType,
          message: 'All analyze/validate operations must use server endpoints',
        }
      );

      this.emit('constraint:violation', {
        constraint: 'sandboxCompliance',
        violation,
        operationType,
      });

      throw violation;
    }

    this.emit('sandbox:validated', { operationId, operationType });
  }

  /**
   * Validate idempotent operation constraint
   */
  validateIdempotency(
    operation: string,
    inputs: unknown,
    expectedOutput: unknown,
    actualOutput: unknown,
    operationId?: string
  ): void {
    if (!this.deepEqual(expectedOutput, actualOutput)) {
      const violation = new ConstraintViolationError(
        'idempotency',
        'non-deterministic output',
        'identical output for identical inputs',
        {
          operationId,
          operation,
          inputs,
          expectedOutput,
          actualOutput,
        }
      );

      this.emit('constraint:violation', {
        constraint: 'idempotency',
        violation,
        operation,
      });

      throw violation;
    }

    this.emit('idempotency:validated', { operationId, operation });
  }

  /**
   * Get current constraint status and metrics
   */
  getConstraintStatus(): {
    constraints: Constraints;
    activeOperations: number;
    rateLimitStatus: {
      current: number;
      limit: number;
      windowStart: number;
      windowEnd: number;
    };
    violations: {
      total: number;
      byType: Record<string, number>;
    };
  } {
    return {
      constraints: { ...this.constraints },
      activeOperations: this.operations.size,
      rateLimitStatus: {
        current: this.rateLimitState.requests,
        limit: this.constraints.rateLimit.requests,
        windowStart: this.rateLimitState.windowStart,
        windowEnd: this.rateLimitState.windowStart + this.constraints.rateLimit.windowMs,
      },
      violations: {
        total: this.listenerCount('constraint:violation'),
        byType: {}, // Would be populated by violation tracking
      },
    };
  }

  /**
   * Enforce rate limiting constraint
   */
  private enforceRateLimit(): void {
    const now = Date.now();

    // Reset window if expired
    if (now - this.rateLimitState.windowStart >= this.constraints.rateLimit.windowMs) {
      this.rateLimitState.requests = 0;
      this.rateLimitState.windowStart = now;
    }

    // Check if rate limit exceeded
    if (this.rateLimitState.requests >= this.constraints.rateLimit.requests) {
      const violation = new ConstraintViolationError(
        'rateLimit',
        `${this.rateLimitState.requests + 1} requests`,
        `≤${this.constraints.rateLimit.requests} requests per ${this.constraints.rateLimit.windowMs}ms`,
        {
          windowStart: this.rateLimitState.windowStart,
          windowEnd: this.rateLimitState.windowStart + this.constraints.rateLimit.windowMs,
          currentRequests: this.rateLimitState.requests,
        }
      );

      this.emit('constraint:violation', {
        constraint: 'rateLimit',
        violation,
        rateLimitState: { ...this.rateLimitState },
      });

      throw violation;
    }

    // Increment request count
    this.rateLimitState.requests++;
    this.emit('rateLimit:checked', {
      requests: this.rateLimitState.requests,
      limit: this.constraints.rateLimit.requests,
    });
  }

  /**
   * Calculate payload size in bytes
   */
  private calculatePayloadSize(data: unknown): number {
    if (typeof data === 'string') {
      return Buffer.byteLength(data, 'utf8');
    }

    if (Buffer.isBuffer(data)) {
      return data.length;
    }

    // For objects, serialize to JSON and calculate size
    const serialized = JSON.stringify(data);
    return Buffer.byteLength(serialized, 'utf8');
  }

  /**
   * Format bytes in human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Deep equality comparison for idempotency validation
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;

    if (a == null || b == null) return a === b;

    if (typeof a !== typeof b) return false;

    if (typeof a !== 'object') return false;

    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;

    const keysA = Object.keys(aObj);
    const keysB = Object.keys(bObj);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEqual(aObj[key], bObj[key])) return false;
    }

    return true;
  }
}

/**
 * Global constraint enforcer instance
 */
export const globalConstraintEnforcer = new ConstraintEnforcer();

/**
 * Decorator for automatic constraint enforcement on async functions
 */
export function withConstraints(operation: string) {
  return <T extends (...args: any[]) => Promise<any>>(
    _target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) => {
    const method = descriptor.value!;

    descriptor.value = async function (this: any, ...args: any[]) {
      const operationId = globalConstraintEnforcer.startOperation(operation, {
        method: propertyName,
        args: args.length,
      });

      try {
        const result = await method.apply(this, args);
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
 * Utility function to wrap any async operation with constraints
 */
export async function constrainedOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const operationId = globalConstraintEnforcer.startOperation(operation, metadata);

  try {
    const result = await fn();
    globalConstraintEnforcer.endOperation(operationId);
    return result;
  } catch (error) {
    globalConstraintEnforcer.endOperation(operationId);
    throw error;
  }
}
