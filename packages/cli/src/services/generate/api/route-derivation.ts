/**
 * @packageDocumentation
 * Route derivation utilities for service endpoint detection.
 *
 * Analyzes application specifications to determine endpoint ownership,
 * derive route bindings, and extract response metadata for code generation.
 */

import { slugify } from "@/services/generate/util/shared.js";
import {
  type AppSpec,
  type PathSpec,
  getBehaviorsArray,
  getPackages,
} from "@arbiter/specification";

export const SUPPORTED_HTTP_METHODS: Array<keyof PathSpec> = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
];

export interface RouteBindingInput {
  method: string;
  url: string;
  summary?: string;
  reply?: unknown;
  statusCode?: number;
}

/**
 * Check if a language is TypeScript-compatible
 */
export function isTypeScriptServiceLanguage(language?: string): boolean {
  if (!language) return true;
  const normalized = language.toLowerCase();
  return normalized === "typescript" || normalized === "javascript" || normalized === "node";
}

/**
 * Extract aliases from service name
 */
function extractNameAliases(serviceName: string, aliases: Set<string>): void {
  aliases.add(serviceName.toLowerCase());
  const withoutSuffix = serviceName.replace(/-(api|service|svc)$/i, "");
  aliases.add(withoutSuffix.toLowerCase());
  serviceName.split(/[-_]/g).forEach((token) => {
    if (token) aliases.add(token.toLowerCase());
  });
}

/**
 * Extract aliases from capabilities
 */
function extractCapabilityAliases(capabilities: any[], aliases: Set<string>): void {
  for (const capability of capabilities) {
    const contract = capability?.contractRef;
    if (typeof contract === "string" && contract.length) {
      const [ref] = contract.split("@");
      if (ref) {
        ref
          .split(/[-_.:/]/)
          .filter(Boolean)
          .forEach((segment) => aliases.add(segment.toLowerCase()));
      }
    }
  }
}

/**
 * Derive service name aliases for endpoint matching
 */
export function deriveServiceAliases(serviceName: string, serviceSpec?: any): string[] {
  const aliases = new Set<string>();

  if (serviceName) {
    extractNameAliases(serviceName, aliases);
  }

  const capabilities = Array.isArray(serviceSpec?.capabilities) ? serviceSpec.capabilities : [];
  extractCapabilityAliases(capabilities, aliases);

  if (Array.isArray(serviceSpec?.domains)) {
    for (const domain of serviceSpec.domains) {
      if (typeof domain === "string") aliases.add(domain.toLowerCase());
    }
  }

  return Array.from(aliases).filter(Boolean);
}

/**
 * Check if first path segment matches any alias
 */
function matchesFirstSegment(normalizedPath: string, aliases: string[]): boolean {
  const firstSegment = normalizedPath.split("/")[0];
  return aliases.includes(firstSegment);
}

/**
 * Check if path starts with or contains an alias pattern
 */
function matchesAliasPattern(normalizedPath: string, aliases: string[]): boolean {
  return aliases.some(
    (alias) =>
      alias && (normalizedPath.startsWith(`${alias}/`) || normalizedPath.includes(`${alias}-`)),
  );
}

/**
 * Check if path is a webhook path matching webhook aliases
 */
function matchesWebhookPattern(normalizedPath: string, aliases: string[]): boolean {
  return normalizedPath.includes("webhook") && aliases.some((alias) => alias.includes("webhook"));
}

/**
 * Determine if a path belongs to a given service
 */
export function pathBelongsToService(
  pathKey: string,
  serviceName: string,
  serviceSpec: any,
): boolean {
  const aliases = deriveServiceAliases(serviceName, serviceSpec);
  if (aliases.length === 0) {
    return false;
  }

  const normalizedPath = pathKey.replace(/^\/+/, "").toLowerCase();
  if (!normalizedPath) {
    return false;
  }

  return (
    matchesFirstSegment(normalizedPath, aliases) ||
    matchesAliasPattern(normalizedPath, aliases) ||
    matchesWebhookPattern(normalizedPath, aliases)
  );
}

/**
 * Determine ownership of paths based on service assignments
 */
export function determinePathOwnership(appSpec: AppSpec): Map<string, string> {
  const ownership = new Map<string, string>();
  if ((appSpec as any).paths) {
    for (const [serviceName, pathSpec] of Object.entries((appSpec as any).paths)) {
      if (!pathSpec || typeof pathSpec !== "object") continue;
      const slug = slugify(serviceName, serviceName);
      for (const pathKey of Object.keys(pathSpec as Record<string, unknown>)) {
        ownership.set(pathKey, slug);
      }
    }
  }

  // Collect packages for path ownership
  const allServices = Object.entries(getPackages(appSpec)).filter(([, pkg]) =>
    isTypeScriptServiceLanguage((pkg as any)?.language as string | undefined),
  );

  for (const behavior of getBehaviorsArray(appSpec)) {
    for (const step of behavior.steps ?? []) {
      const api = step.expect_api;
      if (!api?.path || ownership.has(api.path)) {
        continue;
      }

      for (const [serviceName, serviceSpec] of allServices) {
        if (pathBelongsToService(api.path, serviceName, serviceSpec)) {
          ownership.set(api.path, slugify(serviceName, serviceName));
          break;
        }
      }
    }
  }

  return ownership;
}

/**
 * Merge route bindings, avoiding duplicates
 */
export function mergeRouteBindings(
  base: RouteBindingInput[],
  additional: RouteBindingInput[],
): RouteBindingInput[] {
  const routeMap = new Map<string, RouteBindingInput>();
  for (const binding of base) {
    const key = `${binding.method} ${binding.url}`.toUpperCase();
    routeMap.set(key, binding);
  }
  for (const binding of additional) {
    const key = `${binding.method} ${binding.url}`.toUpperCase();
    if (!routeMap.has(key)) {
      routeMap.set(key, binding);
    }
  }
  return Array.from(routeMap.values());
}

/**
 * Extract response metadata from OpenAPI operation
 */
export function extractResponseMetadata(operation: any): { statusCode: number; example?: unknown } {
  const responses = operation?.responses;
  if (!responses || typeof responses !== "object") {
    return { statusCode: 200 };
  }

  const preferredStatuses = ["200", "201", "202", "204", "default"];
  const responseEntries = Object.entries(responses);
  const orderedStatuses = [...preferredStatuses, ...responseEntries.map(([status]) => status)];

  for (const status of orderedStatuses) {
    const response = (responses as Record<string, any>)[status];
    if (!response) continue;

    const example =
      response.example ??
      extractExampleFromContent(response.content) ??
      response.examples?.default ??
      response.examples?.[0];

    if (example !== undefined) {
      const numericStatus = Number.parseInt(status, 10);
      return { statusCode: Number.isFinite(numericStatus) ? numericStatus : 200, example };
    }

    const numericStatus = Number.parseInt(status, 10);
    if (Number.isFinite(numericStatus)) {
      return { statusCode: numericStatus };
    }
  }

  return { statusCode: 200 };
}

/**
 * Extract example from OpenAPI content block
 */
export function extractExampleFromContent(content: any): unknown {
  if (!content || typeof content !== "object") {
    return undefined;
  }
  for (const media of Object.values(content)) {
    if (!media || typeof media !== "object") continue;
    if ((media as any).example !== undefined) {
      return (media as any).example;
    }
    const schemaExample = (media as any).schema?.example;
    if (schemaExample !== undefined) {
      return schemaExample;
    }
  }
  return undefined;
}

/**
 * Check if path service name matches the target service
 */
function isExplicitServiceMatch(
  pathServiceName: string,
  serviceOriginal: string,
  serviceSlug: string,
  normalizedOriginal: string,
): boolean {
  const normalizedPathService = slugify(pathServiceName, pathServiceName);
  return (
    pathServiceName === serviceOriginal ||
    pathServiceName === serviceSlug ||
    normalizedPathService === serviceSlug ||
    normalizedPathService === normalizedOriginal
  );
}

/**
 * Check if a path belongs to a service based on ownership or matching rules
 */
function doesPathBelongToService(
  pathKey: string,
  explicitMatch: boolean,
  owner: string | undefined,
  serviceSlug: string,
  serviceOriginal: string,
  serviceSpec: any,
): boolean {
  return (
    explicitMatch ||
    owner === serviceSlug ||
    (!owner && pathBelongsToService(pathKey, serviceOriginal, serviceSpec))
  );
}

/**
 * Build default reply payload for unimplemented endpoint
 */
function buildDefaultReply(
  serviceSlug: string,
  summary: string,
  method: string,
  pathKey: string,
): Record<string, unknown> {
  return {
    service: serviceSlug,
    status: "not_implemented",
    summary,
    method: method.toUpperCase(),
    path: pathKey,
  };
}

/**
 * Extract route binding from a path operation
 */
function extractRouteBinding(
  pathKey: string,
  method: string,
  operation: any,
  serviceSlug: string,
): RouteBindingInput {
  const summary = operation.summary || `${method.toUpperCase()} ${pathKey}`;
  const { statusCode, example } = extractResponseMetadata(operation);
  const replyPayload = example ?? buildDefaultReply(serviceSlug, summary, method, pathKey);

  return {
    method: method.toUpperCase(),
    url: pathKey,
    summary,
    reply: replyPayload,
    statusCode,
  };
}

export function deriveServiceEndpointsFromPaths(
  appSpec: AppSpec | undefined,
  serviceName: string,
  serviceSlug: string,
  serviceSpec: any,
  pathOwnership?: Map<string, string>,
): RouteBindingInput[] {
  if (!(appSpec as any)?.paths) {
    return [];
  }

  const results: RouteBindingInput[] = [];
  const normalizedOriginal = slugify(serviceName, serviceName);

  for (const [pathServiceName, pathSpec] of Object.entries((appSpec as any).paths)) {
    if (!pathSpec || typeof pathSpec !== "object") {
      continue;
    }

    const explicitMatch = isExplicitServiceMatch(
      pathServiceName,
      serviceName,
      serviceSlug,
      normalizedOriginal,
    );

    for (const [pathKey, pathDefinition] of Object.entries(pathSpec as Record<string, PathSpec>)) {
      const owner = pathOwnership?.get(pathKey);
      const belongs = doesPathBelongToService(
        pathKey,
        explicitMatch,
        owner,
        serviceSlug,
        serviceName,
        serviceSpec,
      );

      if (!belongs) continue;

      for (const method of SUPPORTED_HTTP_METHODS) {
        const operation = (pathDefinition as Record<string, any>)[method];
        if (!operation) continue;

        results.push(extractRouteBinding(pathKey, method, operation, serviceSlug));
      }
    }
  }

  return results;
}

/**
 * Derive service endpoints from behaviors
 */
export function deriveServiceEndpointsFromBehaviors(
  appSpec: AppSpec | undefined,
  serviceName: string,
  serviceSlug: string,
  serviceSpec: any,
): RouteBindingInput[] {
  if (getBehaviorsArray(appSpec).length === 0) {
    return [];
  }

  const results: RouteBindingInput[] = [];
  const serviceOriginal = serviceName;

  for (const behavior of getBehaviorsArray(appSpec)) {
    for (const step of behavior.steps ?? []) {
      const api = step.expect_api;
      if (!api?.path) continue;
      if (!pathBelongsToService(api.path, serviceOriginal, serviceSpec)) continue;

      const method = (api.method || "GET").toUpperCase();
      const summary = `${behavior.id} ${method} ${api.path}`;
      const statusCode = Number.isFinite(api.status)
        ? Number(api.status)
        : method === "POST"
          ? 201
          : 200;

      results.push({
        method,
        url: api.path,
        summary,
        reply: {
          service: serviceSlug,
          behavior: behavior.id,
          status: "not_implemented",
          method,
          path: api.path,
        },
        statusCode,
      });
    }
  }

  return results;
}
