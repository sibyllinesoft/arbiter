/**
 * Utility functions for Spec Workbench backend
 */
import { createHash } from "node:crypto";
import { isAbsolute, normalize, resolve, sep } from "node:path";
import { CueRunner } from "@arbiter/cue-runner";
import { runSafeCommand } from "../lib/ProcessManager";
import type { ExternalToolResult, ProblemDetails } from "../util/types.ts";

// Re-export from modular group/issue spec builder
export { buildGroupIssueSpec, coerceStringArray } from "./groupIssue";

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
    const { stdout, stderr, exitCode } = await runSafeCommand([command, ...args], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      timeoutMs,
    });
    const duration = Date.now() - startTime;

    return {
      success: exitCode === 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode,
      durationMs: duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : "Unknown error",
      exitCode: -1,
      durationMs: duration,
    };
  }
}

/**
 * Format CUE content using cue fmt command
 */
export async function formatCUE(
  content: string,
): Promise<{ formatted: string; success: boolean; error?: string }> {
  // Write content to temporary file
  const tempFileName = `temp_${generateId()}.cue`;
  const tempFile = `/tmp/${tempFileName}`;

  try {
    await Bun.write(tempFile, content);

    const runner = new CueRunner({ cwd: "/tmp" });
    const result = await runner.fmt([tempFileName]);

    if (result.success) {
      const formatted = await Bun.file(tempFile).text();
      return { formatted, success: true };
    }
    return {
      formatted: content,
      success: false,
      error: result.stderr || "Failed to format CUE content",
    };
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
export function validatePath(targetPath: string, baseDir: string = process.cwd()): boolean {
  if (!targetPath) {
    return false;
  }

  if (targetPath.includes("\0")) {
    return false;
  }

  const sanitised = targetPath.replace(/\\+/g, "/");
  const normalisedInput = normalize(sanitised).replace(/\\+/g, "/");

  // Reject absolute paths or attempts to traverse up the directory tree
  if (
    isAbsolute(normalisedInput) ||
    normalisedInput.startsWith("..") ||
    normalisedInput.includes("/../")
  ) {
    return false;
  }

  // Only allow a conservative character set
  const pathRegex = /^[a-zA-Z0-9._/\-]+$/;
  if (!pathRegex.test(normalisedInput)) {
    return false;
  }

  const resolvedBase = resolve(baseDir);
  const resolvedTarget = resolve(resolvedBase, normalisedInput);
  const baseWithSep = resolvedBase.endsWith(sep) ? resolvedBase : `${resolvedBase}${sep}`;

  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(baseWithSep);
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
