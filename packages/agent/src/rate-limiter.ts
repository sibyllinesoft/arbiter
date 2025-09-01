/**
 * Rate Limiter for Arbiter API requests
 * 
 * Implements strict rate limiting as required by the operating prompt:
 * - ≤1 rps per client
 * - Jittered backoff on 429 responses
 * - Single retry with exponential backoff
 */

export class RateLimiter {
  private lastRequestTime = 0;
  private readonly intervalMs: number;
  
  constructor(requestsPerSecond: number) {
    this.intervalMs = 1000 / requestsPerSecond;
  }
  
  /**
   * Wait for the next available slot respecting rate limits
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.intervalMs) {
      const waitTime = this.intervalMs - timeSinceLastRequest;
      await this.sleep(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }
  
  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Jittered backoff for retry scenarios
   */
  static calculateBackoff(attempt: number, baseDelayMs: number = 1000): number {
    const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attempt), 30000); // max 30s
    const jitter = Math.random() * 0.1; // ±10% jitter
    return exponentialDelay * (1 + jitter);
  }
}

/**
 * Fetch wrapper with rate limiting and retry logic
 */
export async function rateLimitedFetch(
  url: string,
  options: RequestInit,
  rateLimiter: RateLimiter,
  maxRetries: number = 1
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await rateLimiter.waitForSlot();
      
      const response = await fetch(url, options);
      
      // Handle rate limiting response
      if (response.status === 429) {
        if (attempt < maxRetries) {
          const retryAfter = response.headers.get('Retry-After');
          const backoffMs = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : RateLimiter.calculateBackoff(attempt);
          
          console.warn(`Rate limited (429), backing off for ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        } else {
          throw new Error(`Rate limited and max retries (${maxRetries}) exceeded`);
        }
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const backoffMs = RateLimiter.calculateBackoff(attempt);
        console.warn(`Request failed, retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
    }
  }
  
  throw lastError || new Error('Request failed after all retries');
}