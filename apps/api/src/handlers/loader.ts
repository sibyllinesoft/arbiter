import { readFile } from "node:fs/promises";
import { HandlerSandbox } from "./sandbox.js";
import { CloudflareR2HandlerAdapter } from "./storage/cloudflare-r2.js";
import type { HandlerModule, Logger, RegisteredHandler } from "./types.js";

export interface HandlerLoaderOptions {
  cloudflareR2Adapter?: CloudflareR2HandlerAdapter;
}

export class HandlerLoader {
  private sandbox: HandlerSandbox;

  constructor(
    private logger: Logger,
    private readonly options: HandlerLoaderOptions = {},
  ) {
    this.sandbox = new HandlerSandbox(logger);
  }

  async load(handler: RegisteredHandler): Promise<HandlerModule> {
    const code = await this.readHandlerSource(handler);
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

    const moduleExports = sandboxResult.value as HandlerModule | undefined;
    if (!moduleExports) {
      throw new Error("Handler module did not export any values");
    }

    const hasHandler = typeof moduleExports.handler === "function";
    const hasCloudflare =
      typeof moduleExports.cloudflare === "object" && moduleExports.cloudflare !== null;

    if (!hasHandler && !hasCloudflare) {
      throw new Error("Handler module must export a handler function or Cloudflare configuration");
    }

    return moduleExports;
  }

  private async readHandlerSource(handler: RegisteredHandler): Promise<string> {
    if (handler.storage === "cloudflare-r2") {
      if (!this.options.cloudflareR2Adapter) {
        throw new Error(
          `Cloudflare R2 adapter not configured. Cannot load handler "${handler.handlerPath}".`,
        );
      }
      return await this.options.cloudflareR2Adapter.readHandlerSource(handler.handlerPath);
    }

    return await readFile(handler.handlerPath, "utf-8");
  }
}
