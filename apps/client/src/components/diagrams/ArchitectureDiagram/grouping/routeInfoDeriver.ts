/**
 * @module ArchitectureDiagram/grouping/routeInfoDeriver
 * Derives route information from grouped component items.
 */

import { normalizeRelativePath } from "./helpers";
import type { GroupedComponentItem } from "./types";

/**
 * Route information derived from a grouped item.
 */
export interface RouteInfo {
  routerType: string;
  controllerRelativePath: string;
  fullRoutePath: string;
  baseRoutePath: string;
  routeSegments: string[];
  baseSegments: string[];
  displayLabel: string;
  isBaseRoute: boolean;
}

/**
 * Splits a path string into segments.
 */
export const splitSegments = (value: string): string[] =>
  value.replace(/^\/+/, "").split("/").filter(Boolean);

/**
 * Normalizes a route path for consistent formatting.
 */
export const normalizeRoutePath = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  const trimmed = String(value).trim();
  if (trimmed === "") return "";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, "/");
  if (collapsed.length > 1 && /\/+$/.test(collapsed)) {
    return collapsed.replace(/\/+$/, "");
  }
  return collapsed;
};

/**
 * Gets a route identifier from an item's various possible sources.
 */
export const getRouteIdentifier = (item: GroupedComponentItem): string | undefined => {
  const metadata = item.data.metadata || {};
  const candidate =
    item.data.path ||
    metadata.routePath ||
    metadata.displayLabel ||
    item.data.displayLabel ||
    item.data.name ||
    item.name;
  if (!candidate) return undefined;
  const trimmed = String(candidate).trim();
  return trimmed === "" ? undefined : trimmed;
};

/**
 * Determines if the route is a base route.
 */
const isBaseRouteCheck = (
  metadata: Record<string, unknown>,
  routeSegments: string[],
  baseSegments: string[],
): boolean => {
  if (Boolean(metadata.isBaseRoute)) return true;
  if (baseSegments.length === 0) return false;
  if (routeSegments.length !== baseSegments.length) return false;
  return baseSegments.every((segment, index) => routeSegments[index] === segment);
};

/**
 * Derives the display label for a route.
 */
const deriveDisplayLabel = (
  metadata: Record<string, unknown>,
  isBaseRoute: boolean,
  fullRoutePath: string,
): string => {
  const metadataDisplayLabel =
    typeof metadata.displayLabel === "string" ? metadata.displayLabel : null;
  if (metadataDisplayLabel && metadataDisplayLabel.trim().length > 0) {
    return metadataDisplayLabel;
  }
  return isBaseRoute ? "/" : fullRoutePath || "/";
};

/**
 * Derives route information from a grouped component item.
 */
export const deriveRouteInfo = (item: GroupedComponentItem): RouteInfo => {
  const metadata = (item.data.metadata || {}) as Record<string, unknown>;
  const routerType = String(metadata.routerType || item.data.routerType || "").toLowerCase();
  const packageRoot = String(metadata.packageRoot || metadata.root || "");
  const rawFilePath = String(
    metadata.controllerPath || metadata.filePath || item.data.filePath || "",
  );
  const controllerRelativePath = normalizeRelativePath(rawFilePath, packageRoot);

  const routeBasePath = normalizeRoutePath(metadata.routeBasePath);
  const routePathCandidate =
    metadata.routePath || metadata.path || item.data.path || getRouteIdentifier(item) || "";
  const normalizedRoutePath = normalizeRoutePath(routePathCandidate);
  const fullRoutePath = normalizedRoutePath || routeBasePath || "/";

  const routeSegments = splitSegments(fullRoutePath);
  const baseSegments = routeBasePath ? splitSegments(routeBasePath) : [];
  const isBaseRoute = isBaseRouteCheck(metadata, routeSegments, baseSegments);
  const displayLabel = deriveDisplayLabel(metadata, isBaseRoute, fullRoutePath);

  return {
    routerType,
    controllerRelativePath,
    fullRoutePath,
    baseRoutePath: routeBasePath,
    routeSegments,
    baseSegments,
    displayLabel,
    isBaseRoute,
  };
};
