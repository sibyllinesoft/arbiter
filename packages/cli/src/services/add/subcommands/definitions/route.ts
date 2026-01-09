/**
 * @packageDocumentation
 * Route subcommand module - Handles adding frontend routes to CUE specifications.
 *
 * Supports defining:
 * - Page routes with path patterns
 * - Capability requirements
 * - Component associations
 */

import type { RouteConfig } from "@/cue/index.js";

/** Options for route configuration */
export interface RouteOptions {
  id?: string;
  capabilities?: string;
  components?: string;
  [key: string]: any;
}

/**
 * Add a frontend route to the CUE specification.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param routePath - URL path pattern for the route
 * @param options - Route configuration options
 * @returns Updated CUE file content
 */
export async function addRoute(
  manipulator: any,
  content: string,
  routePath: string,
  options: RouteOptions,
): Promise<string> {
  const routeId = options.id || generateRouteId(routePath);
  const capabilities = options.capabilities
    ? options.capabilities.split(",").map((s: string) => s.trim())
    : ["view"];
  const components = options.components
    ? options.components.split(",").map((s: string) => s.trim())
    : [];

  const routeConfig: RouteConfig = {
    id: routeId,
    path: routePath,
    capabilities,
    ...(components.length > 0 && { components }),
  };

  return await manipulator.addRoute(content, routeConfig);
}

/**
 * Generate a route ID from the pathname.
 * @param pathname - The route pathname to convert
 * @returns Generated route ID string
 */
function generateRouteId(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "home:main";
  if (segments.length === 1) return `${segments[0]}:main`;
  return segments.join(":");
}
