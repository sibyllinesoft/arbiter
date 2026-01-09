/**
 * @module ArchitectureDiagram/grouping/buildPackagesFromGroup
 * Builds FrontendPackage structures from a grouped component group.
 * Handles route normalization, endpoint parsing, and tree path derivation.
 */

import { normalizeEndpoint } from "./endpointNormalizer";
import { normalizeRelativePath } from "./helpers";
import { resolvePackageKey } from "./packageKeyResolver";
import { type RouteInfo, deriveRouteInfo } from "./routeInfoDeriver";
import type { FrontendPackage, GroupedComponentGroup, GroupedComponentItem } from "./types";

/** Keywords to filter out noise routes */
const NOISE_KEYWORDS = [
  "dockerfile-container",
  "nats-compose",
  "spec-workbench-compose",
  "api-types",
];

/**
 * Checks if a route should be filtered as noise.
 */
const isNoiseRoute = (
  packageName: string,
  displayLabel: string,
  fullRoutePath: string,
  isBaseRoute: boolean,
): boolean => {
  if (isBaseRoute) return false;

  const lowerPackageName = packageName.toLowerCase();
  const lowerDisplayLabel = (displayLabel || "").toLowerCase();
  const lowerRoutePath = (fullRoutePath || "").toLowerCase();

  return NOISE_KEYWORDS.some((keyword) => {
    const lower = keyword.toLowerCase();
    return (
      lowerPackageName.includes(lower) ||
      lowerDisplayLabel.includes(lower) ||
      lowerRoutePath.includes(lower)
    );
  });
};

/**
 * Computes the tree segments for a route.
 */
const computeTreeSegments = (info: RouteInfo): string[] => {
  if (info.isBaseRoute) return [];

  if (info.routerType === "tsoa" && info.baseSegments.length > 0) {
    const matchesBase = info.baseSegments.every(
      (segment, index) => info.routeSegments[index] === segment,
    );
    if (matchesBase) {
      return info.routeSegments.slice(info.baseSegments.length);
    }
  }

  return info.routeSegments;
};

/**
 * Ensures a package exists in the packages map, creating it if necessary.
 */
const ensurePackage = (
  packages: Map<string, FrontendPackage>,
  item: GroupedComponentItem,
  group: GroupedComponentGroup,
  routeInfo?: RouteInfo,
): FrontendPackage => {
  const metadata = item.data.metadata || {};
  const packageRoot = String(metadata.packageRoot || metadata.root || "");
  const packageKey = resolvePackageKey(item, group, routeInfo);

  if (!packages.has(packageKey)) {
    const frameworks = new Set<string>();
    if (metadata.framework) {
      frameworks.add(String(metadata.framework));
    }

    packages.set(packageKey, {
      packageName: packageKey,
      packageRoot,
      frameworks: Array.from(frameworks),
      components: [],
      routes: [],
    });
  }

  const pkg = packages.get(packageKey)!;
  if (metadata.framework && !pkg.frameworks.includes(String(metadata.framework))) {
    pkg.frameworks.push(String(metadata.framework));
  }

  return pkg;
};

/**
 * Processes a route item and adds it to the package.
 */
const processRouteItem = (
  pkg: FrontendPackage,
  item: GroupedComponentItem,
  routeInfo: RouteInfo,
): void => {
  const metadata = item.data.metadata || {};
  const treeSegments = computeTreeSegments(routeInfo);
  const treePath = treeSegments.join("/");

  const displayLabel =
    routeInfo.routerType === "tsoa" && treeSegments.length > 0
      ? `/${treeSegments.join("/")}`
      : routeInfo.displayLabel;

  const routePathForDisplay = routeInfo.isBaseRoute ? "/" : routeInfo.fullRoutePath;

  // Check for noise routes
  if (isNoiseRoute(pkg.packageName, displayLabel, routeInfo.fullRoutePath, routeInfo.isBaseRoute)) {
    return;
  }

  // Extract HTTP methods
  const httpMethods = Array.isArray(metadata.httpMethods)
    ? metadata.httpMethods.map((method: unknown) => String(method).toUpperCase())
    : Array.isArray((item.data as any)?.httpMethods)
      ? (item.data as any).httpMethods.map((method: unknown) => String(method).toUpperCase())
      : [];

  // Normalize endpoints
  const rawEndpoints = Array.isArray(metadata.endpoints) ? metadata.endpoints : [];
  const endpoints = rawEndpoints.map(normalizeEndpoint);

  const routeMetadata = {
    ...metadata,
    httpMethods,
    endpoints,
  };

  pkg.routes = pkg.routes || [];
  pkg.routes.push({
    path: routePathForDisplay,
    filePath: routeInfo.controllerRelativePath,
    treePath,
    routerType: (metadata.routerType as string | undefined) || routeInfo.routerType,
    displayLabel: displayLabel || routePathForDisplay,
    httpMethods,
    endpoints,
    metadata: routeMetadata,
    isBaseRoute: routeInfo.isBaseRoute,
  });
};

/**
 * Processes a component item and adds it to the package.
 */
const processComponentItem = (pkg: FrontendPackage, item: GroupedComponentItem): void => {
  const metadata = item.data.metadata || {};
  const filePath = normalizeRelativePath(
    String(metadata.filePath || item.data.filePath || ""),
    pkg.packageRoot || "",
  );

  pkg.components = pkg.components || [];
  pkg.components.push({
    name: item.data.name || item.name,
    filePath,
    framework: String(metadata.framework || ""),
    description: item.data.description || metadata.description,
    props: item.data.props,
  });
};

/**
 * Cleans up empty arrays from a package.
 */
const cleanupPackage = (pkg: FrontendPackage): FrontendPackage => {
  if (!pkg.components || pkg.components.length === 0) {
    delete pkg.components;
  }
  if (!pkg.routes || pkg.routes.length === 0) {
    delete pkg.routes;
  }
  return pkg;
};

/**
 * Builds FrontendPackage structures from a grouped component group.
 * @param group - The component group to build packages from
 * @returns Array of FrontendPackage structures
 */
export const buildPackagesFromGroup = (group: GroupedComponentGroup): FrontendPackage[] => {
  const packages = new Map<string, FrontendPackage>();
  const isRoutesMode = group.treeMode === "routes";

  group.items.forEach((item: GroupedComponentItem) => {
    const routeInfo = isRoutesMode ? deriveRouteInfo(item) : undefined;
    const pkg = ensurePackage(packages, item, group, routeInfo);

    if (isRoutesMode && routeInfo) {
      processRouteItem(pkg, item, routeInfo);
    } else {
      processComponentItem(pkg, item);
    }
  });

  return Array.from(packages.values()).map(cleanupPackage);
};
