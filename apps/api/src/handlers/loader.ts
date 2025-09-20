import { readFile } from "node:fs/promises";
import { HandlerSandbox } from "./sandbox.js";
import type { HandlerModule, Logger, RegisteredHandler } from "./types.js";

export class HandlerLoader {
  private sandbox: HandlerSandbox;

  constructor(private logger: Logger) {
    this.sandbox = new HandlerSandbox(logger);
  }

  async load(handler: RegisteredHandler): Promise<HandlerModule> {
    const code = await readFile(handler.handlerPath, "utf-8");
    const validation = this.sandbox.validate(code);
    if (!validation.safe) {
      throw new Error(`Handler code contains unsafe patterns: ${validation.violations.join(", ")}`);
    }

    const sandboxResult = await this.sandbox.run<HandlerModule>({
      code,
      filename: handler.handlerPath,
      context: {
        exports: {},
        module: { exports: {} },
        require: undefined,
        process: undefined,
      },
      timeoutMs: handler.config.timeout,
    });

    if (!sandboxResult.success || !sandboxResult.value) {
      throw sandboxResult.error || new Error("Handler execution failed to initialize");
    }

    if (sandboxResult.logs.length > 0) {
      sandboxResult.logs.forEach((log) => {
        this.logger.info(`[sandbox:${log.level}] ${log.message}`, log.data);
      });
    }

    const moduleExports = sandboxResult.value;
    if (!moduleExports || typeof moduleExports.handler !== "function") {
      throw new Error("Handler module must export a handler function");
    }

    return moduleExports as HandlerModule;
  }
}
