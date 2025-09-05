/**
 * Utility functions for Spec Workbench backend
 */
import { createHash } from "node:crypto";
import type { ExternalToolResult, ProblemDetails, RateLimitBucket } from "./types.ts";

/**
 * Generate a unique ID using crypto.randomUUID()
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Compute SHA256 hash of a string
 */
export function computeSpecHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Execute external command with timeout and proper error handling
 */
export async function executeCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
  } = {},
): Promise<ExternalToolResult> {
  const startTime = Date.now();
  const timeoutMs = options.timeout ?? 10000; // 10s default

  try {
    const proc = Bun.spawn([command, ...args], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdout: "pipe",
      stderr: "pipe",
    });

    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Wait for process to complete or timeout
    const _result = await Promise.race([proc.exited, timeoutPromise]);

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = proc.exitCode ?? 1;
    const duration = Date.now() - startTime;

    return {
      success: exitCode === 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exit_code: exitCode,
      duration_ms: duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : "Unknown error",
      exit_code: -1,
      duration_ms: duration,
    };
  }
}

/**
 * Format CUE content using cue fmt command
 */
export async function formatCUE(
  content: string,
  cueBinaryPath: string = "cue",
): Promise<{ formatted: string; success: boolean; error?: string }> {
  // Write content to temporary file
  const tempFile = `/tmp/temp_${generateId()}.cue`;

  try {
    await Bun.write(tempFile, content);

    const result = await executeCommand(cueBinaryPath, ["fmt", tempFile], {
      timeout: 5000,
    });

    if (result.success) {
      const formatted = await Bun.file(tempFile).text();
      return { formatted, success: true };
    } else {
      return {
        formatted: content,
        success: false,
        error: result.stderr || "Failed to format CUE content",
      };
    }
  } catch (error) {
    return {
      formatted: content,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    // Clean up temp file
    try {
      (await Bun.file(tempFile).exists()) && (await Bun.write(tempFile, ""));
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Create RFC 7807 Problem Details error response
 */
export function createProblemDetails(
  status: number,
  title: string,
  detail?: string,
  type?: string,
  instance?: string,
  extensions?: Record<string, unknown>,
): ProblemDetails {
  return {
    type: type ?? `https://httpstatuses.com/${status}`,
    title,
    status,
    ...(detail && { detail }),
    ...(instance && { instance }),
    ...extensions,
  };
}

/**
 * Token bucket rate limiter implementation
 */
export class TokenBucket {
  private buckets = new Map<string, RateLimitBucket>();

  constructor(
    private maxTokens: number = 10,
    private refillRate: number = 1, // tokens per second
    private windowMs: number = 10000, // 10 seconds
  ) {}

  /**
   * Check if request is allowed and consume a token
   */
  consume(identifier: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(identifier);

    if (!bucket) {
      bucket = {
        tokens: this.maxTokens - 1, // consume one token
        last_refill: now,
        max_tokens: this.maxTokens,
        refill_rate: this.refillRate,
      };
      this.buckets.set(identifier, bucket);
      return true;
    }

    // Calculate tokens to add based on time passed
    const timePassed = now - bucket.last_refill;
    const tokensToAdd = Math.floor((timePassed / 1000) * this.refillRate);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(bucket.max_tokens, bucket.tokens + tokensToAdd);
      bucket.last_refill = now;
    }

    // Check if we have tokens available
    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    return false;
  }

  /**
   * Get current token count for identifier
   */
  getTokenCount(identifier: string): number {
    const bucket = this.buckets.get(identifier);
    if (!bucket) return this.maxTokens;

    // Calculate current tokens
    const now = Date.now();
    const timePassed = now - bucket.last_refill;
    const tokensToAdd = Math.floor((timePassed / 1000) * this.refillRate);

    return Math.min(bucket.max_tokens, bucket.tokens + tokensToAdd);
  }

  /**
   * Clean up old buckets to prevent memory leaks
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs * 2; // Keep buckets for 2x window size

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.last_refill < cutoff) {
        this.buckets.delete(key);
      }
    }
  }
}

/**
 * Ensure directory exists, create if it doesn't
 */
export async function ensureDir(path: string): Promise<void> {
  try {
    const stat = await Bun.file(path).exists();
    if (!stat) {
      await Bun.spawn(["mkdir", "-p", path]).exited;
    }
  } catch (error) {
    throw new Error(`Failed to create directory ${path}: ${error}`);
  }
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T = any>(
  json: string,
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(json);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

/**
 * Validate that a string is a valid file path (security check)
 */
export function validatePath(path: string): boolean {
  // Prevent directory traversal attacks
  if (path.includes("..") || path.includes("~") || path.startsWith("/")) {
    return false;
  }

  // Only allow alphanumeric, dots, slashes, hyphens, underscores
  const pathRegex = /^[a-zA-Z0-9._/-]+$/;
  return pathRegex.test(path);
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Simple logger with structured output
 */
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        level: "info",
        message,
        timestamp: getCurrentTimestamp(),
        ...meta,
      }),
    );
  },

  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(
      JSON.stringify({
        level: "warn",
        message,
        timestamp: getCurrentTimestamp(),
        ...meta,
      }),
    );
  },

  error: (message: string, error?: Error, meta?: Record<string, unknown>) => {
    console.error(
      JSON.stringify({
        level: "error",
        message,
        error: error?.message,
        stack: error?.stack,
        timestamp: getCurrentTimestamp(),
        ...meta,
      }),
    );
  },

  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(
        JSON.stringify({
          level: "debug",
          message,
          timestamp: getCurrentTimestamp(),
          ...meta,
        }),
      );
    }
  },
};

/**
 * Parse bearer token from Authorization header
 */
export function parseBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim();
}
