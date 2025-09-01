import type { RetryOptions } from './types.js';
import { NetworkError, TimeoutError } from './errors.js';

/**
 * Retry configuration with exponential backoff
 */
export class RetryConfig {
  public readonly maxRetries: number;
  public readonly baseDelay: number;
  public readonly maxDelay: number;
  public readonly backoffFactor: number;
  public readonly jitter: number;

  constructor(options: RetryOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelay = options.baseDelay ?? 1000;
    this.maxDelay = options.maxDelay ?? 10000;
    this.backoffFactor = options.backoffFactor ?? 2;
    this.jitter = options.jitter ?? 0.1;
  }

  /**
   * Calculate delay for the given attempt number
   */
  calculateDelay(attempt: number): number {
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffFactor, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);
    
    // Add jitter to avoid thundering herd
    const jitterAmount = cappedDelay * this.jitter * Math.random();
    return Math.floor(cappedDelay + jitterAmount);
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: unknown): boolean {
    if (error instanceof TimeoutError) {
      return true;
    }

    if (error instanceof NetworkError) {
      // Retry on 5xx errors, 429 (rate limit), and connection errors
      return !error.statusCode || 
             error.statusCode >= 500 || 
             error.statusCode === 429 ||
             error.statusCode === 408; // Request timeout
    }

    // Retry on generic network errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('network') ||
             message.includes('connection') ||
             message.includes('timeout') ||
             message.includes('econnreset') ||
             message.includes('enotfound');
    }

    return false;
  }
}

/**
 * Exponential backoff utility
 */
export class ExponentialBackoff {
  constructor(private config: RetryConfig) {}

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry if we've exhausted attempts or error is not retryable
        if (attempt > this.config.maxRetries || !this.config.isRetryable(error)) {
          throw error;
        }

        const delay = this.config.calculateDelay(attempt);
        
        // Log retry attempt if context provided
        if (context) {
          console.debug(`[Arbiter SDK] Retry ${attempt}/${this.config.maxRetries} for ${context} after ${delay}ms delay:`, error);
        }

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Sleep for given milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create exponential backoff with default configuration
 */
export function createExponentialBackoff(options?: RetryOptions): ExponentialBackoff {
  return new ExponentialBackoff(new RetryConfig(options));
}