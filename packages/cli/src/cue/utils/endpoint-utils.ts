/**
 * @packageDocumentation
 * Endpoint building utilities for CUE manipulation.
 *
 * Provides functionality to:
 * - Build endpoint identifiers from config
 * - Generate operation objects
 * - Build handler references
 */

import type { EndpointConfig } from "../types.js";

/**
 * Build an endpoint identifier from config
 */
export function buildEndpointIdentifier(config: EndpointConfig): string {
  const normalized = config.path.replace(/^\//, "").replace(/[{}]/g, "");
  const segments = normalized
    .split(/[\/_-]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
  const base = segments.length > 0 ? segments.join("-") : "root";
  return `${config.method.toLowerCase()}-${base}`.replace(/-+/g, "-");
}

/**
 * Build a default handler reference
 */
export function buildDefaultHandlerReference(
  service: string,
  method: string,
  path: string,
): { type: string; module: string; function: string } {
  return {
    type: "module",
    module: `${service}/handlers/routes`,
    function: buildHandlerFunctionName(method, path),
  };
}

/**
 * Build handler function name from method and path
 */
export function buildHandlerFunctionName(method: string, path: string): string {
  const cleaned = path
    .replace(/^\//, "")
    .replace(/[{}]/g, "")
    .split(/[\/_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join("");
  const suffix = cleaned || "Root";
  const methodPrefix = method.toLowerCase();
  return `${methodPrefix}${suffix}`;
}

/**
 * Build operation object from endpoint config
 */
export function buildOperationObject(config: EndpointConfig): Record<string, unknown> {
  return {
    ...(config.summary && { summary: config.summary }),
    ...(config.description && { description: config.description }),
    ...(config.implements && { implements: config.implements }),
    ...(config.request && { request: config.request }),
    ...(config.response && { response: config.response }),
  };
}

/**
 * Build endpoint entry object for service endpoints
 */
export function buildEndpointEntry(
  config: EndpointConfig,
  _endpointId: string,
): Record<string, unknown> {
  return {
    path: config.path,
    methods: [config.method.toUpperCase()],
    ...(config.implements && { implements: config.implements }),
    handler:
      config.handler ?? buildDefaultHandlerReference(config.service, config.method, config.path),
  };
}
