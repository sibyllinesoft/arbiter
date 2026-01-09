/**
 * @packageDocumentation
 * Route manipulation utilities for CUE operations.
 *
 * Provides functionality to:
 * - Format route identifiers for removal markers
 * - Match routes by identifier
 * - Append route removal markers
 */

/**
 * Route identifier for matching routes.
 */
export interface RouteIdentifier {
  id?: string;
  path?: string;
}

/**
 * Append route removal marker to content.
 */
export function appendRouteRemovalMarker(content: string, identifier: RouteIdentifier): string {
  const idPart = formatRouteIdentifierPart("id", identifier.id);
  const pathPart = formatRouteIdentifierPart("path", identifier.path);
  const fields = [idPart, pathPart].filter(Boolean).join(", ");
  const marker = [
    "// removal marker (append-only)",
    "removals: removals & {",
    `  routes: [..., { ${fields} }]`,
    "}",
  ].join("\n");
  return `${content.trimEnd()}\n\n${marker}\n`;
}

/**
 * Format a route identifier part for CUE output.
 */
export function formatRouteIdentifierPart(name: string, value?: string): string {
  if (!value || value.trim().length === 0) return "";
  return `${name}: "${value.replace(/"/g, '\\"')}"`;
}

/**
 * Check if identifier has at least one valid property.
 */
export function hasRouteIdentifier(identifier: RouteIdentifier): boolean {
  return Boolean(identifier.id || identifier.path);
}

/**
 * Check if a route matches the given identifier.
 */
export function matchesRouteIdentifier(route: any, identifier: RouteIdentifier): boolean {
  const matchesId = identifier.id ? route.id === identifier.id : false;
  const matchesPath = identifier.path ? route.path === identifier.path : false;

  if (identifier.id && identifier.path) {
    return matchesId || matchesPath;
  }
  return identifier.id ? matchesId : matchesPath;
}
