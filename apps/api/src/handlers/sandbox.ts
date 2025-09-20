import { pathToFileURL } from "node:url";
import vm from "node:vm";
import type { Logger } from "./types.js";

export interface SandboxResult<T = unknown> {
  success: boolean;
  value?: T;
  error?: Error;
  logs: Array<{ level: "info" | "warn" | "error"; message: string; data?: any }>;
}

export interface SandboxOptions {
  code: string;
  context?: Record<string, unknown>;
  timeoutMs?: number;
  filename?: string;
}

const DEFAULT_TIMEOUT = 2000;

export class HandlerSandbox {
  constructor(private logger: Logger) {}

  async run<T = unknown>(options: SandboxOptions): Promise<SandboxResult<T>> {
    const logs: SandboxResult["logs"] = [];
    const sandboxLogger: Logger = {
      info: (message, data) => logs.push({ level: "info", message, data }),
      warn: (message, data) => logs.push({ level: "warn", message, data }),
      error: (message, data) => logs.push({ level: "error", message, data }),
      debug: () => {},
    };

    const context = {
      console: {
        log: (...args: unknown[]) => logs.push({ level: "info", message: args.join(" ") }),
        warn: (...args: unknown[]) => logs.push({ level: "warn", message: args.join(" ") }),
        error: (...args: unknown[]) => logs.push({ level: "error", message: args.join(" ") }),
      },
      logger: sandboxLogger,
      ...options.context,
    };

    const vmContext = vm.createContext(context, {
      name: "handler-sandbox",
      codeGeneration: { strings: false, wasm: false },
    });

    try {
      const script = new vm.Script(options.code, {
        filename: options.filename ?? "handler.js",
        displayErrors: true,
      });

      script.runInContext(vmContext, {
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT,
      });

      const exported = (vmContext.module?.exports ?? vmContext.exports) as T;

      return { success: true, value: exported, logs };
    } catch (error) {
      this.logger.error("Sandbox execution failed", error as Error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        logs,
      };
    }
  }

  validate(code: string): { safe: boolean; violations: string[] } {
    const violations: string[] = [];
    if (/process\./.test(code)) {
      violations.push("Usage of process.* is not allowed");
    }
    if (/require\s*\(/.test(code) || /import\s*\(/.test(code)) {
      violations.push("Dynamic module loading is not allowed");
    }
    return { safe: violations.length === 0, violations };
  }
}
