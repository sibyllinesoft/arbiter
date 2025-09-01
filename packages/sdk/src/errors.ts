/**
 * Base error class for all Arbiter SDK errors
 */
export class ArbiterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ArbiterError';
    Object.setPrototypeOf(this, ArbiterError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Network-related errors (connection, timeout, etc.)
 */
export class NetworkError extends ArbiterError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: unknown
  ) {
    super(message, 'NETWORK_ERROR', { statusCode, response });
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Validation-related errors (schema validation, etc.)
 */
export class ValidationError extends ArbiterError {
  constructor(
    message: string,
    public readonly violations: unknown[]
  ) {
    super(message, 'VALIDATION_ERROR', { violations });
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends ArbiterError {
  constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message, 'TIMEOUT_ERROR', { timeoutMs });
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Server compatibility errors
 */
export class CompatibilityError extends ArbiterError {
  constructor(
    message: string,
    public readonly sdkVersion: string,
    public readonly serverVersion: string
  ) {
    super(message, 'COMPATIBILITY_ERROR', { sdkVersion, serverVersion });
    this.name = 'CompatibilityError';
    Object.setPrototypeOf(this, CompatibilityError.prototype);
  }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends ArbiterError {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_ERROR', { retryAfter });
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}