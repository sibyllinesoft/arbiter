import type { R2Bucket, R2Object } from "@cloudflare/workers-types";

export type HandlerProvider = "github" | "gitlab";

export interface CloudflareR2HandlerAdapterOptions {
  /**
   * Name of the R2 bucket binding exposed in the Cloudflare environment.
   */
  bindingName: string;
  /**
   * Optional prefix to scope handler files within the bucket. Defaults to "handlers".
   */
  prefix?: string;
}

export interface CloudflareR2HandlerObject {
  key: string;
  provider: HandlerProvider;
  eventName: string;
  extension: string;
}

type R2ListResponse = {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
};

/**
 * Adapter that exposes handler source files stored inside a Cloudflare R2 bucket.
 */
export class CloudflareR2HandlerAdapter {
  private readonly prefix: string;
  private bucket?: R2Bucket;

  constructor(private readonly options: CloudflareR2HandlerAdapterOptions) {
    this.prefix = (options.prefix ?? "handlers").replace(/\/+$/, "");
  }

  async listHandlers(provider: HandlerProvider): Promise<CloudflareR2HandlerObject[]> {
    const bucket = this.resolveBucket();
    const prefix = this.buildProviderPrefix(provider);
    const discovered: CloudflareR2HandlerObject[] = [];

    let cursor: string | undefined;
    do {
      const response: R2ListResponse = await bucket.list({
        prefix,
        cursor,
        limit: 1000,
      });

      for (const object of response.objects) {
        const descriptor = this.describeObject(provider, object.key);
        if (descriptor) {
          discovered.push(descriptor);
        }
      }

      cursor = response.truncated ? response.cursor : undefined;
    } while (cursor);

    return discovered;
  }

  async readHandlerSource(key: string): Promise<string> {
    const bucket = this.resolveBucket();
    const object = await bucket.get(key);

    if (!object) {
      throw new Error(`Cloudflare R2 handler object "${key}" could not be found.`);
    }

    return await object.text();
  }

  private describeObject(
    provider: HandlerProvider,
    key: string,
  ): CloudflareR2HandlerObject | undefined {
    if (!key.startsWith(this.prefix)) {
      return undefined;
    }

    const trimmed = key.slice(this.prefix.length).replace(/^\/+/, "");
    const segments = trimmed.split("/");

    if (segments.length < 2) {
      return undefined;
    }

    const objectProvider = segments[0];
    if (objectProvider !== provider) {
      return undefined;
    }

    const filename = segments.slice(1).join("/");
    const dotIndex = filename.lastIndexOf(".");
    if (dotIndex <= 0) {
      return undefined;
    }

    const extension = filename.slice(dotIndex);
    if (![".js", ".ts", ".mjs", ".mts", ".cjs"].includes(extension)) {
      return undefined;
    }

    const eventName = filename.slice(0, dotIndex);

    return {
      key,
      provider,
      eventName,
      extension,
    };
  }

  private buildProviderPrefix(provider: HandlerProvider): string {
    return `${this.prefix}/${provider}/`;
  }

  private resolveBucket(): R2Bucket {
    if (!this.bucket) {
      const binding = this.locateBinding(this.options.bindingName);
      if (!binding) {
        throw new Error(
          `Cloudflare R2 binding "${this.options.bindingName}" was not found on the global scope.`,
        );
      }
      this.bucket = binding;
    }
    return this.bucket;
  }

  private locateBinding(bindingName: string): R2Bucket | undefined {
    const globalAny = globalThis as Record<string, unknown>;
    const candidates: Array<unknown> = [
      globalAny,
      (globalAny as { env?: Record<string, unknown> }).env,
      (globalAny as { __env__?: Record<string, unknown> }).__env__,
      (globalAny as { bindings?: Record<string, unknown> }).bindings,
      (globalAny as { __bindings__?: Record<string, unknown> }).__bindings__,
      (
        globalAny as {
          __arbiter?: { cloudflare?: { r2?: Record<string, unknown> } };
        }
      ).__arbiter?.cloudflare?.r2,
    ];

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") {
        continue;
      }

      const bucket = (candidate as Record<string, unknown>)[bindingName];
      if (this.isR2Bucket(bucket)) {
        return bucket;
      }
    }

    return undefined;
  }

  private isR2Bucket(value: unknown): value is R2Bucket {
    if (!value || typeof value !== "object") {
      return false;
    }

    const bucket = value as { get?: unknown; list?: unknown };
    return typeof bucket.get === "function" && typeof bucket.list === "function";
  }
}
