/**
 * @module ArchitectureDiagram/grouping/packageKeyResolver
 * Resolves package keys from grouped component items.
 */

import type { RouteInfo } from "./routeInfoDeriver";
import { getRouteIdentifier } from "./routeInfoDeriver";
import type { GroupedComponentGroup, GroupedComponentItem } from "./types";

/**
 * Normalizes a package key for routes mode.
 */
export const normalizeRoutesPackageKey = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "/";
  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "") || trimmed;
};

/**
 * Resolves package key for routes tree mode.
 */
const resolveRoutesPackageKey = (
  item: GroupedComponentItem,
  routeInfo: RouteInfo | undefined,
  metadataPackageName: string,
  normalizedServiceName: string,
): string => {
  const metadata = item.data.metadata || {};

  if (metadataPackageName) return metadataPackageName;
  if (normalizedServiceName) return normalizedServiceName;
  if (routeInfo?.baseRoutePath && routeInfo.baseRoutePath !== "/") {
    return routeInfo.baseRoutePath;
  }
  if (metadata.packageRoot) return String(metadata.packageRoot);
  if (routeInfo?.routeSegments.length) return routeInfo.routeSegments[0];

  const routeIdentifier = getRouteIdentifier(item);
  return routeIdentifier || "/";
};

/**
 * Resolves package key for non-routes tree mode.
 */
const resolveDefaultPackageKey = (
  item: GroupedComponentItem,
  metadataPackageName: string,
  normalizedServiceName: string,
): string => {
  const metadata = item.data.metadata || {};
  const filePath = String(metadata.filePath || item.data.filePath || "");

  if (metadataPackageName) return metadataPackageName;
  if (normalizedServiceName) return normalizedServiceName;
  if (metadata.packageName) return String(metadata.packageName);
  if (metadata.root) return String(metadata.root);
  if (filePath.includes("/")) return filePath.split("/")[0];

  return filePath;
};

/**
 * Extracts and normalizes service name from metadata.
 */
const extractServiceName = (metadata: Record<string, unknown>): string => {
  const rawServiceName = String(
    metadata.serviceDisplayName || metadata.serviceName || metadata.packageName || "",
  ).replace(/^@[^/]+\//, "");
  return rawServiceName.trim();
};

/**
 * Extracts metadata package name.
 */
const extractMetadataPackageName = (metadata: Record<string, unknown>): string => {
  return String(
    metadata.packageName || metadata.serviceDisplayName || metadata.serviceName || "",
  ).trim();
};

/**
 * Resolves the package key for a grouped component item.
 */
export const resolvePackageKey = (
  item: GroupedComponentItem,
  group: GroupedComponentGroup,
  routeInfo?: RouteInfo,
): string => {
  const metadata = item.data.metadata || {};
  const normalizedServiceName = extractServiceName(metadata);
  const metadataPackageName = extractMetadataPackageName(metadata);
  const isRoutesMode = group.treeMode === "routes";

  let packageKey: string;

  if (isRoutesMode) {
    packageKey = resolveRoutesPackageKey(
      item,
      routeInfo,
      metadataPackageName,
      normalizedServiceName,
    );
  } else {
    packageKey = resolveDefaultPackageKey(item, metadataPackageName, normalizedServiceName);
  }

  // Fallback if no key resolved
  if (!packageKey) {
    const routeIdentifier = getRouteIdentifier(item);
    packageKey = isRoutesMode ? routeIdentifier || item.name || "/routes" : group.label;
  }

  // Normalize the key
  let normalizedKey = String(packageKey || "Routes").trim();
  if (isRoutesMode) {
    normalizedKey = normalizeRoutesPackageKey(normalizedKey);
  }

  return normalizedKey || (isRoutesMode ? "/" : group.label || "Group");
};
