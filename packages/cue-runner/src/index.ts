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

    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
    }, this.timeoutMs);

    try {
      const prevCwd = process.cwd();
      process.chdir(this.cwd);
      try {
        const flags =
          cmd === "export" ? { "--out": "json" } : cmd === "fmt" || cmd === "vet" ? {} : {};
        const result = await cue(cmd, rest, flags);
        if (typeof result === "string") {
          stdout = result;
        } else if (result && typeof result === "object") {
          stdout = (result as any).stdout ?? "";
          stderr = (result as any).stderr ?? "";
          exitCode = typeof (result as any).code === "number" ? (result as any).code : 0;
        }
      } finally {
        process.chdir(prevCwd);
      }
    } catch (error: any) {
      exitCode = -1;
      stdout = typeof error?.stdout === "string" ? error.stdout : "";
      stderr = typeof error?.stderr === "string" ? error.stderr : (error?.message ?? String(error));
    } finally {
      clearTimeout(timeout);
    }

    return {
      success: !timedOut && exitCode === 0,
      exitCode,
      stdout: String(stdout).trim(),
      stderr: String(stderr).trim(),
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

export function createCueRunner(options: CueRunnerOptions): CueRunner {
  return new CueRunner(options);
}

export * from "./fixtures.js";
export * from "./ast.js";
