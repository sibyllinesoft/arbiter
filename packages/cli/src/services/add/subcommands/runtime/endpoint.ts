/**
 * @packageDocumentation
 * Endpoint subcommand module - Handles adding API endpoints to CUE specifications.
 *
 * Provides functionality to:
 * - Define HTTP endpoints with method and path
 * - Configure request/response schemas
 * - Generate handler references
 * - Auto-configure health checks
 */

import path from "node:path";
import type { EndpointConfig } from "@/cue/index.js";

/** Options for endpoint configuration */
export interface EndpointOptions {
  service?: string;
  method?: string;
  returns?: string;
  accepts?: string;
  summary?: string;
  description?: string;
  implements?: string;
  handlerModule?: string;
  handlerFn?: string;
  endpointId?: string;
  [key: string]: any;
}

/**
 * Validate that a service exists in the CUE content
 */
async function validateServiceExists(
  manipulator: any,
  content: string,
  service: string,
): Promise<void> {
  try {
    const ast = await manipulator.parse(content);
    if (!ast.services || !ast.services[service]) {
      throw new Error(
        `Service "${service}" not found. Add it first with: arbiter add service ${service}`,
      );
    }
  } catch {
    if (!content.includes(`${service}:`)) {
      throw new Error(
        `Service "${service}" not found. Add it first with: arbiter add service ${service}`,
      );
    }
  }
}

/**
 * Build endpoint configuration from options
 */
function buildEndpointConfig(endpoint: string, options: EndpointOptions): EndpointConfig {
  const {
    service = "api",
    method = "GET",
    returns,
    accepts,
    summary,
    description,
    implements: contractRef,
    handlerModule,
    handlerFn,
    endpointId,
  } = options;

  return {
    service,
    path: endpoint,
    method,
    summary,
    description,
    implements: contractRef,
    endpointId: endpointId ?? generateEndpointIdentifier(method, endpoint),
    handler: buildEndpointHandlerDescriptor(service, handlerModule, handlerFn, method, endpoint),
    ...(accepts && { request: { $ref: `#/components/schemas/${accepts}` } }),
    ...(returns && { response: { $ref: `#/components/schemas/${returns}` } }),
  };
}

/**
 * Check if endpoint is a health endpoint
 */
function isHealthEndpoint(endpoint: string): boolean {
  return endpoint === "/health" || endpoint.endsWith("/health");
}

/**
 * Add health check to service if endpoint is a health endpoint
 */
async function addHealthCheckIfNeeded(
  manipulator: any,
  content: string,
  service: string,
  endpoint: string,
): Promise<string> {
  if (!isHealthEndpoint(endpoint)) {
    return content;
  }

  const healthCheck = { path: endpoint, port: 3000 };

  try {
    const ast = await manipulator.parse(content);
    if (!ast.services[service].healthCheck) {
      ast.services[service].healthCheck = healthCheck;
      return await manipulator.serialize(ast, content);
    }
  } catch {
    console.warn("Could not add health check via AST, health endpoint added to paths only");
  }

  return content;
}

/**
 * Add an API endpoint to a service in the CUE specification.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param endpoint - Endpoint path (e.g., "/users/{id}")
 * @param options - Endpoint configuration options
 * @returns Updated CUE file content
 */
export async function addEndpoint(
  manipulator: any,
  content: string,
  endpoint: string,
  options: EndpointOptions,
): Promise<string> {
  const service = options.service ?? "api";

  await validateServiceExists(manipulator, content, service);

  const endpointConfig = buildEndpointConfig(endpoint, options);
  let updatedContent = await manipulator.addEndpoint(content, endpointConfig);

  updatedContent = await addHealthCheckIfNeeded(manipulator, updatedContent, service, endpoint);

  return updatedContent;
}

/**
 * Generate a unique identifier for an endpoint.
 * @param method - HTTP method
 * @param endpoint - Endpoint path
 * @returns Generated endpoint identifier
 */
function generateEndpointIdentifier(method: string, endpoint: string): string {
  const normalizedPath = endpoint.replace(/^\//, "").replace(/[{}]/g, "");
  const segments = normalizedPath
    .split(/[\/_-]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
  const methodLower = method.toLowerCase();
  const base = segments.length > 0 ? segments.join("-") : "root";
  return `${methodLower}-${base}`.replace(/-+/g, "-");
}

/**
 * Build the handler descriptor for an endpoint.
 * @param service - Service name
 * @param modulePath - Optional handler module path
 * @param functionName - Optional handler function name
 * @param method - HTTP method
 * @param endpoint - Endpoint path
 * @returns Handler descriptor object
 */
function buildEndpointHandlerDescriptor(
  service: string,
  modulePath: string | undefined,
  functionName: string | undefined,
  method: string,
  endpoint: string,
) {
  const resolvedModule =
    modulePath ?? path.posix.join(service.replace(/\\/g, "/"), "handlers", "routes");
  const resolvedFunction = functionName ?? generateHandlerFunctionName(method, endpoint, service);
  return {
    type: "module" as const,
    module: resolvedModule,
    function: resolvedFunction,
  };
}

/**
 * Generate a handler function name from method, endpoint, and service.
 * @param method - HTTP method
 * @param endpoint - Endpoint path
 * @param service - Service name
 * @returns Generated function name
 */
function generateHandlerFunctionName(method: string, endpoint: string, service: string): string {
  const sanitized = endpoint
    .replace(/^\//, "")
    .replace(/[{}]/g, "")
    .split(/[\/_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join("");
  const suffix = sanitized || "Root";
  // Convert service name to PascalCase (task-api -> TaskApi)
  const prefix = service
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join("");
  return `${method.toLowerCase()}${prefix}${suffix}`;
}
