/**
 * Data processing utilities for architecture diagram grouping.
 * Extracted from utils.ts to reduce complexity.
 */

import { getComponentType } from "./component-type-detection";

const CUE_FILE_REGEX = /\.cue$/i;

type AddToGroupFn = (type: string, name: string, data: any) => void;

/** Check if item should be excluded from diagram */
export function shouldExcludeFromDiagram(item: any): boolean {
  const candidates = [
    item?.metadata?.filePath,
    item?.metadata?.sourceFile,
    item?.filePath,
    item?.sourceFile,
  ]
    .filter(Boolean)
    .map((path) => String(path));

  return candidates.some((path) => CUE_FILE_REGEX.test(path));
}

/** Enrich data with type and metadata for grouping */
export function enrichDataForGrouping(data: any, enforcedType: string): any {
  return {
    ...data,
    type: data.type || enforcedType,
    metadata: {
      ...(data.metadata || {}),
    },
  };
}

/** Process services entries */
export function processServices(services: Record<string, any>, addToGroup: AddToGroupFn): void {
  Object.entries(services).forEach(([name, originalData]) => {
    if (!originalData) return;
    if (shouldExcludeFromDiagram(originalData)) return;
    const type = getComponentType(originalData, name);
    const data = enrichDataForGrouping(originalData, type);
    addToGroup(type, name, data);
  });
}

/** Process database entries */
export function processDatabases(databases: Record<string, any>, addToGroup: AddToGroupFn): void {
  Object.entries(databases).forEach(([name, data]) => {
    if (!data) return;
    const databaseData = enrichDataForGrouping(data, "database");
    if (shouldExcludeFromDiagram(databaseData)) return;
    addToGroup("database", name, databaseData);
  });
}

/** Process component entries */
export function processComponents(components: Record<string, any>, addToGroup: AddToGroupFn): void {
  Object.entries(components).forEach(([name, originalData]) => {
    if (!originalData) return;
    if (shouldExcludeFromDiagram(originalData)) return;
    const type = getComponentType(originalData, name);
    const data = enrichDataForGrouping(originalData, type);
    addToGroup(type, name, data);
  });
}

/** Process route entries */
export function processRoutes(routes: any[], addToGroup: AddToGroupFn): void {
  routes.forEach((route) => {
    if (!route) return;
    const name = route.id || route.name || route.path || "route";
    const baseMetadata = route.metadata || {};
    const routerType = baseMetadata.routerType;
    const derivedType = routerType && routerType !== "tsoa" ? "view" : "route";
    const routeData = {
      ...route,
      name: route.name || route.path || name,
      metadata: baseMetadata,
      type: derivedType,
    };
    if (shouldExcludeFromDiagram(routeData)) return;
    const type = getComponentType(routeData, name);
    addToGroup(type, name, routeData);
  });
}

const normalizeSlashes = (value: string): string => value.replace(/\\/g, "/");

/** Normalize relative path against package root */
export function normalizeRelativePath(filePath: string | undefined, packageRoot: string): string {
  if (!filePath) return "";
  const normalizedFile = normalizeSlashes(filePath).replace(/^\/+/, "");
  if (!packageRoot) return normalizedFile;

  const normalizedRoot = normalizeSlashes(packageRoot).replace(/^\/+|\/+$/g, "");
  if (!normalizedRoot) return normalizedFile;

  if (normalizedFile.startsWith(normalizedRoot)) {
    const trimmed = normalizedFile.slice(normalizedRoot.length);
    return trimmed.replace(/^\/+/, "");
  }

  return normalizedFile;
}

/** Process frontend packages */
export function processFrontendPackages(frontendPackages: any[], addToGroup: AddToGroupFn): void {
  frontendPackages.forEach((pkg: any) => {
    const packageName = pkg.packageName || pkg.name || "frontend";
    const packageRoot = pkg.packageRoot || pkg.root || ".";

    // Process components in package
    (pkg.components || []).forEach((component: any) => {
      const name = `${packageName}:${component.name}`;
      const relativeFilePath = normalizeRelativePath(component.filePath, packageRoot);
      const data = enrichDataForGrouping(
        {
          ...component,
          metadata: {
            ...component.metadata,
            packageName,
            packageRoot,
            filePath: relativeFilePath,
            displayLabel: component.name,
          },
        },
        "component",
      );
      if (shouldExcludeFromDiagram(data)) return;
      addToGroup("component", name, data);
    });

    // Process routes in package
    (pkg.routes || []).forEach((route: any) => {
      const name = `${packageName}:${route.path || route.filePath || "view"}`;
      const relativeFilePath = normalizeRelativePath(route.filePath, packageRoot);
      const displayLabel = route.path || route.filePath || route.name || name;
      const data = enrichDataForGrouping(
        {
          ...route,
          name: displayLabel,
          metadata: {
            ...route.metadata,
            packageName,
            packageRoot,
            routerType: route.routerType || "frontend",
            filePath: relativeFilePath,
            displayLabel,
          },
        },
        "view",
      );
      if (shouldExcludeFromDiagram(data)) return;
      addToGroup("view", name, data);
    });
  });
}
