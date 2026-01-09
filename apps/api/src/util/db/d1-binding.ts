/**
 * @module util/db/d1-binding
 * Cloudflare D1 binding resolution utilities.
 */

import type { D1Database } from "@cloudflare/workers-types";

/**
 * Checks if a value is a valid D1 database binding.
 */
export function isValidD1Binding(value: unknown): value is D1Database {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { prepare?: unknown }).prepare === "function"
  );
}

/**
 * Attempts to resolve a D1 binding from a source object.
 */
export function tryResolveD1From(source: unknown, key: string): D1Database | undefined {
  if (!source) {
    return undefined;
  }

  if (isValidD1Binding(source)) {
    return source;
  }

  if (typeof source === "object" && key in source) {
    const value = (source as Record<string, unknown>)[key];
    if (isValidD1Binding(value)) {
      return value;
    }
  }

  return undefined;
}

/**
 * Resolves a Cloudflare D1 binding from global scope.
 */
export function resolveCloudflareD1Binding(bindingName?: string): D1Database {
  const name = bindingName?.trim();

  if (!name) {
    throw new Error(
      "ServerConfig.database.binding must be provided when using the `cloudflare-d1` driver.",
    );
  }

  const globalAny = globalThis as Record<string, unknown>;
  const sources: Array<unknown> = [
    globalAny,
    (globalAny as { env?: Record<string, unknown> }).env,
    (globalAny as { __env__?: Record<string, unknown> }).__env__,
    (globalAny as { bindings?: Record<string, unknown> }).bindings,
    (globalAny as { __bindings__?: Record<string, unknown> }).__bindings__,
    (globalAny as { __D1_BETA__?: Record<string, unknown> }).__D1_BETA__,
    (globalAny as { __ARB_CLOUDFLARE_D1__?: unknown }).__ARB_CLOUDFLARE_D1__,
    (
      globalAny as {
        __arbiter?: { cloudflare?: { d1?: Record<string, unknown> } };
      }
    ).__arbiter?.cloudflare?.d1,
  ];

  for (const source of sources) {
    const binding = tryResolveD1From(source, name);
    if (binding) {
      return binding;
    }
  }

  throw new Error(
    `Cloudflare D1 binding "${name}" was not found on the global scope. ` +
      "Pass a D1 client via SpecWorkbenchDB.create({ client }) or expose the binding on globalThis.",
  );
}
