/**
 * @packageDocumentation
 * Arbiter Validation Layer
 *
 * Provides spec validation and transformation functionality.
 * Implementation uses CUE under the hood but this is an internal detail.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { init as initCueWasm } from "cue-wasm";

// Singleton for the initialized CUE WASM instance
let cueInstance: Awaited<ReturnType<typeof initCueWasm>> | null = null;

async function getCue() {
  if (!cueInstance) {
    cueInstance = await initCueWasm();
  }
  return cueInstance;
}

// ============================================================================
// Public Types
// ============================================================================

/**
 * A diagnostic message from validation
 */
export interface ValidationDiagnostic {
  file?: string;
  line?: number;
  column?: number;
  message: string;
  details?: string;
}

/**
 * Result of validating a spec
 */
export interface ValidationResult {
  valid: boolean;
  diagnostics: ValidationDiagnostic[];
  durationMs: number;
}

/**
 * Result of parsing a spec into structured data
 */
export interface ParseResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  diagnostics: ValidationDiagnostic[];
}

/**
 * Options for validation operations
 */
export interface ValidationOptions {
  /** Working directory for resolving imports */
  cwd?: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Validate spec content against the schema.
 *
 * @param content - The spec content to validate (CUE format)
 * @param options - Validation options
 * @returns Validation result with diagnostics
 */
export async function validateSpec(
  content: string,
  options: ValidationOptions = {},
): Promise<ValidationResult> {
  const validator = new SpecValidator(options);
  return validator.validate(content);
}

/**
 * Parse spec content into structured data.
 *
 * @param content - The spec content to parse (CUE format)
 * @param options - Validation options
 * @returns Parsed data or error
 */
export async function parseSpec(
  content: string,
  options: ValidationOptions = {},
): Promise<ParseResult> {
  const validator = new SpecValidator(options);
  return validator.parse(content);
}

// ============================================================================
// Legacy Exports (for backwards compatibility during migration)
// ============================================================================

/** @deprecated Use ValidationDiagnostic instead */
export type CueDiagnostic = ValidationDiagnostic;

/** @deprecated Use ValidationOptions instead */
export interface CueRunnerOptions {
  cwd: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

/** @deprecated Use ValidationResult instead */
export interface CueVetResult {
  success: boolean;
  diagnostics: ValidationDiagnostic[];
  raw: ExternalToolResult;
}

/** @deprecated Use ParseResult instead */
export interface CueExportResult {
  success: boolean;
  value?: Record<string, unknown>;
  diagnostics: ValidationDiagnostic[];
  error?: string;
  raw: ExternalToolResult;
}

export interface ExternalToolResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

/**
 * @deprecated Use validateSpec/parseSpec functions instead.
 * This class is kept for backwards compatibility during migration.
 */
export class CueRunner {
  private readonly validator: SpecValidator;

  constructor(options: CueRunnerOptions) {
    this.validator = new SpecValidator({
      cwd: options.cwd,
      timeoutMs: options.timeoutMs,
    });
  }

  async vet(targets: string[] = ["./..."]): Promise<CueVetResult> {
    const result = await this.validator.vetTargets(targets);
    return {
      success: result.valid,
      diagnostics: result.diagnostics,
      raw: {
        success: result.valid,
        exitCode: result.valid ? 0 : 1,
        stdout: "",
        stderr: result.diagnostics.map((d) => d.message).join("\n"),
        durationMs: result.durationMs,
        timedOut: false,
      },
    };
  }

  async exportJson(targets: string[] = ["./..."]): Promise<CueExportResult> {
    const result = await this.validator.exportTargets(targets);
    return {
      success: result.success,
      value: result.data,
      diagnostics: result.diagnostics,
      error: result.error,
      raw: {
        success: result.success,
        exitCode: result.success ? 0 : 1,
        stdout: result.data ? JSON.stringify(result.data) : "",
        stderr: result.error || "",
        durationMs: 0,
        timedOut: false,
      },
    };
  }
}

/** @deprecated Use validateSpec/parseSpec functions instead */
export function createCueRunner(options: CueRunnerOptions): CueRunner {
  return new CueRunner(options);
}

// ============================================================================
// Internal Implementation
// ============================================================================

class SpecValidator {
  private readonly cwd: string;
  private readonly timeoutMs: number;

  constructor(options: ValidationOptions = {}) {
    this.cwd = options.cwd || process.cwd();
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async validate(content: string): Promise<ValidationResult> {
    const start = Date.now();

    try {
      const cue = await getCue();
      // cue.parse() will throw if the CUE is invalid
      cue.parse(content);

      return {
        valid: true,
        diagnostics: [],
        durationMs: Date.now() - start,
      };
    } catch (error: any) {
      const message = error?.message || String(error);
      return {
        valid: false,
        diagnostics: this.parseDiagnostics(message),
        durationMs: Date.now() - start,
      };
    }
  }

  async parse(content: string): Promise<ParseResult> {
    try {
      const cue = await getCue();
      const data = cue.parse(content) as Record<string, unknown>;

      return {
        success: true,
        data,
        diagnostics: [],
      };
    } catch (error: any) {
      const message = error?.message || String(error);
      return {
        success: false,
        error: message,
        diagnostics: this.parseDiagnostics(message),
      };
    }
  }

  async vetTargets(targets: string[]): Promise<ValidationResult> {
    const start = Date.now();

    try {
      const content = await this.readTargets(targets);
      const cue = await getCue();
      cue.parse(content);

      return {
        valid: true,
        diagnostics: [],
        durationMs: Date.now() - start,
      };
    } catch (error: any) {
      const message = error?.message || String(error);
      return {
        valid: false,
        diagnostics: this.parseDiagnostics(message),
        durationMs: Date.now() - start,
      };
    }
  }

  async exportTargets(targets: string[]): Promise<ParseResult> {
    try {
      const content = await this.readTargets(targets);
      const cue = await getCue();
      const data = cue.parse(content) as Record<string, unknown>;

      return {
        success: true,
        data,
        diagnostics: [],
      };
    } catch (error: any) {
      const message = error?.message || String(error);
      return {
        success: false,
        error: message,
        diagnostics: this.parseDiagnostics(message),
      };
    }
  }

  /**
   * Read CUE files from targets and concatenate their content.
   * Handles glob patterns like "./..." by finding all .cue files.
   */
  private async readTargets(targets: string[]): Promise<string> {
    const contents: string[] = [];

    for (const target of targets) {
      if (target === "-") {
        // Stdin placeholder - skip, content should be passed directly
        continue;
      }

      if (target === "./..." || target.endsWith("/...")) {
        // Glob pattern - find all .cue files recursively
        const baseDir =
          target === "./..." ? this.cwd : path.join(this.cwd, target.replace("/...", ""));
        const cueFiles = this.findCueFiles(baseDir);
        for (const file of cueFiles) {
          contents.push(fs.readFileSync(file, "utf-8"));
        }
      } else {
        // Single file or directory
        const fullPath = path.isAbsolute(target) ? target : path.join(this.cwd, target);

        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            // Read all .cue files in directory (non-recursive)
            const files = fs
              .readdirSync(fullPath)
              .filter((f) => f.endsWith(".cue"))
              .map((f) => path.join(fullPath, f));
            for (const file of files) {
              contents.push(fs.readFileSync(file, "utf-8"));
            }
          } else {
            contents.push(fs.readFileSync(fullPath, "utf-8"));
          }
        }
      }
    }

    return contents.join("\n\n");
  }

  /**
   * Recursively find all .cue files in a directory
   */
  private findCueFiles(dir: string): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, hidden directories, and common non-source dirs
        if (
          !entry.name.startsWith(".") &&
          entry.name !== "node_modules" &&
          entry.name !== "dist" &&
          entry.name !== "build"
        ) {
          files.push(...this.findCueFiles(fullPath));
        }
      } else if (entry.name.endsWith(".cue")) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private parseDiagnostics(errorMessage: string): ValidationDiagnostic[] {
    const trimmed = errorMessage.trim();
    if (!trimmed) return [];

    const lines = trimmed.split("\n");
    const blocks: string[][] = [];
    let current: string[] = [];

    for (const line of lines) {
      const cleaned = line.trimEnd();
      if (!cleaned.trim()) continue;

      if (this.isDiagnosticHeader(cleaned) && current.length > 0) {
        blocks.push(current);
        current = [cleaned];
        continue;
      }

      current.push(cleaned);
    }

    if (current.length > 0) {
      blocks.push(current);
    }

    // If no structured diagnostics found, return the whole message
    if (blocks.length === 0) {
      return [{ message: trimmed }];
    }

    return blocks.map((block) => this.buildDiagnostic(block));
  }

  private isDiagnosticHeader(line: string): boolean {
    return /^[^:\s][^:]*:\d+:\d+:/.test(line);
  }

  private buildDiagnostic(block: string[]): ValidationDiagnostic {
    const header = block[0]?.trim() ?? "";
    const match = header.match(/^([^:]+):(\d+):(\d+):\s*(.+)$/);
    const details = block
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean);

    if (match) {
      const [, file, line, column, message] = match;
      return {
        file,
        line: Number.parseInt(line, 10),
        column: Number.parseInt(column, 10),
        message: message.trim(),
        details: details.length > 0 ? details.join("\n") : undefined,
      };
    }

    return {
      message: block.join(" ").trim(),
      details: undefined,
    };
  }
}

function safeJsonParse<T = unknown>(
  json: string,
): { success: true; data: T } | { success: false; error: string } {
  try {
    return { success: true, data: JSON.parse(json) as T };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

// Re-export AST utilities (these may be useful for schema inspection)
export * from "./ast.js";
