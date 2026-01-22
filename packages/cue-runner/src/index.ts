import cue from "cuelang-js";

export interface ExternalToolResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export interface CueDiagnostic {
  file?: string;
  line?: number;
  column?: number;
  message: string;
  summary?: string;
  raw: string;
}

export interface CueRunnerOptions {
  cwd: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export interface CueVetResult {
  success: boolean;
  diagnostics: CueDiagnostic[];
  raw: ExternalToolResult;
}

export interface CueExportResult {
  success: boolean;
  value?: Record<string, unknown>;
  diagnostics: CueDiagnostic[];
  error?: string;
  raw: ExternalToolResult;
}

/**
 * Executes CUE commands (vet, export, fmt) using the embedded cuelang-js runtime.
 *
 * Provides structured output with diagnostics parsing for validation errors.
 */
export class CueRunner {
  private readonly cwd: string;
  private readonly timeoutMs: number;
  private readonly env?: NodeJS.ProcessEnv;

  constructor(options: CueRunnerOptions) {
    this.cwd = options.cwd;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.env = options.env;
  }

  async vet(targets: string[] = ["./..."]): Promise<CueVetResult> {
    const result = await this.runCueCommand(["vet", ...targets]);
    const diagnostics = result.success ? [] : this.parseDiagnostics(result.stderr);

    return {
      success: result.success,
      diagnostics,
      raw: result,
    };
  }

  async exportJson(targets: string[] = ["./..."]): Promise<CueExportResult> {
    const result = await this.runCueCommand(["export", "--out", "json", ...targets]);

    if (result.success && result.stdout) {
      const parsed = safeJsonParse<Record<string, unknown>>(result.stdout);
      if (parsed.success) {
        return {
          success: true,
          value: parsed.data,
          diagnostics: [],
          raw: result,
        };
      }

      return {
        success: false,
        diagnostics: [],
        error: `Invalid JSON from CUE export: ${parsed.error}`,
        raw: result,
      };
    }

    const diagnostics = this.parseDiagnostics(result.stderr);

    return {
      success: false,
      diagnostics,
      error: result.stderr || "CUE export failed",
      raw: result,
    };
  }

  async fmt(targets: string[] = ["./..."]): Promise<ExternalToolResult> {
    return this.runCueCommand(["fmt", ...targets]);
  }

  private async runCueCommand(args: string[]): Promise<ExternalToolResult> {
    const start = Date.now();
    const cmd = args[0];
    const rest = args.slice(1);
    const { timedOut, clearTimeoutFn } = this.createTimeout();

    const execution = await this.executeCueInDirectory(cmd, rest, clearTimeoutFn);

    return this.buildResult(execution, start, timedOut());
  }

  /**
   * Creates a timeout tracker for command execution.
   */
  private createTimeout(): { timedOut: () => boolean; clearTimeoutFn: () => void } {
    let hasTimedOut = false;
    const timeout = setTimeout(() => {
      hasTimedOut = true;
    }, this.timeoutMs);

    return {
      timedOut: () => hasTimedOut,
      clearTimeoutFn: () => clearTimeout(timeout),
    };
  }

  /**
   * Executes a CUE command in the configured directory.
   */
  private async executeCueInDirectory(
    cmd: string,
    rest: string[],
    clearTimeoutFn: () => void,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    try {
      const prevCwd = process.cwd();
      process.chdir(this.cwd);
      try {
        const result = await this.invokeCue(cmd, rest);
        ({ stdout, stderr, exitCode } = this.parseResult(result));
      } finally {
        process.chdir(prevCwd);
      }
    } catch (error: any) {
      ({ stdout, stderr, exitCode } = this.handleCueError(error));
    } finally {
      clearTimeoutFn();
    }

    return { stdout, stderr, exitCode };
  }

  /**
   * Invokes the CUE command with appropriate flags.
   */
  private async invokeCue(cmd: string, rest: string[]): Promise<unknown> {
    const flags = cmd === "export" ? { "--out": "json" } : {};
    return cue(cmd, rest, flags);
  }

  /**
   * Parses CUE command result into structured output.
   */
  private parseResult(result: unknown): { stdout: string; stderr: string; exitCode: number } {
    if (typeof result === "string") {
      return { stdout: result, stderr: "", exitCode: 0 };
    }
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      return {
        stdout: (r.stdout as string) ?? "",
        stderr: (r.stderr as string) ?? "",
        exitCode: typeof r.code === "number" ? r.code : 0,
      };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  /**
   * Handles CUE command errors.
   */
  private handleCueError(error: any): { stdout: string; stderr: string; exitCode: number } {
    return {
      exitCode: -1,
      stdout: typeof error?.stdout === "string" ? error.stdout : "",
      stderr: typeof error?.stderr === "string" ? error.stderr : (error?.message ?? String(error)),
    };
  }

  /**
   * Builds the final result object.
   */
  private buildResult(
    execution: { stdout: string; stderr: string; exitCode: number },
    start: number,
    timedOut: boolean,
  ): ExternalToolResult {
    return {
      success: !timedOut && execution.exitCode === 0,
      exitCode: execution.exitCode,
      stdout: String(execution.stdout).trim(),
      stderr: String(execution.stderr).trim(),
      durationMs: Date.now() - start,
      timedOut,
    };
  }

  private parseDiagnostics(stderr: string): CueDiagnostic[] {
    const trimmed = stderr.trim();
    if (!trimmed) {
      return [];
    }

    const lines = trimmed.split("\n");
    const blocks: string[][] = [];
    let current: string[] = [];

    for (const line of lines) {
      const cleaned = line.trimEnd();
      if (!cleaned.trim()) {
        continue;
      }

      if (this.isDiagnosticHeader(cleaned) && current.length > 0) {
        blocks.push(current);
        current = [cleaned];
        continue;
      }

      if (current.length === 0) {
        current.push(cleaned);
      } else {
        current.push(cleaned);
      }
    }

    if (current.length > 0) {
      blocks.push(current);
    }

    return blocks.map((block) => this.buildDiagnostic(block));
  }

  private isDiagnosticHeader(line: string): boolean {
    return /^[^:\s][^:]*:\d+:\d+:/.test(line);
  }

  private buildDiagnostic(block: string[]): CueDiagnostic {
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
        summary: details.length > 0 ? details.join("\n") : undefined,
        raw: block.join("\n"),
      };
    }

    return {
      message: block.join(" ").trim(),
      summary: undefined,
      raw: block.join("\n"),
    };
  }
}

/** Safely parses JSON string, returning a discriminated union result. */
function safeJsonParse<T = unknown>(
  json: string,
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(json) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

/**
 * Factory function to create a CueRunner instance.
 *
 * @param options - Configuration options including working directory and timeout
 * @returns Configured CueRunner instance
 */
export function createCueRunner(options: CueRunnerOptions): CueRunner {
  return new CueRunner(options);
}

export * from "./fixtures.js";
export * from "./ast.js";
