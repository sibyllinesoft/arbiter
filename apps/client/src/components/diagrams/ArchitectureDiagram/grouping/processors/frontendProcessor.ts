/**
 * @module ArchitectureDiagram/grouping/processors/frontendProcessor
 * Processes frontend packages, components, and routes from project data.
 */

import { enrichDataForGrouping, normalizeRelativePath, shouldExcludeFromDiagram } from "../helpers";
import type { Processor, ProcessorContext } from "./types";

/**
 * Processes a single frontend package's components.
 */
const processFrontendComponents = (
  pkg: any,
  packageName: string,
  packageRoot: string,
  ctx: ProcessorContext,
) => {
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
    if (shouldExcludeFromDiagram(data, ctx.isRemovedItem)) return;
    ctx.addToGroup("component", name, data);
  });
};

/**
 * Processes a single frontend package's routes/views.
 */
const processFrontendRoutes = (
  pkg: any,
  packageName: string,
  packageRoot: string,
  ctx: ProcessorContext,
) => {
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
    if (shouldExcludeFromDiagram(data, ctx.isRemovedItem)) return;
    ctx.addToGroup("view", name, data);
  });
};

/**
 * Processes frontend packages from project data.
 * Creates entries for the package itself plus its components and routes.
 */
export const processFrontendPackages: Processor = (projectData, ctx) => {
  const frontendPackages = projectData?.spec?.frontend?.packages || [];

  frontendPackages.forEach((pkg: any) => {
    const packageName = pkg.packageName || pkg.name || "frontend";
    const packageRoot = pkg.packageRoot || pkg.root || ".";

    const frontendSummary = enrichDataForGrouping(
      {
        name: packageName,
        description:
          pkg.description ||
          pkg.summary ||
          `Frontend package located at ${packageRoot || "project root"}`,
        metadata: {
          ...(pkg.metadata || {}),
          packageName,
          packageRoot,
          frameworks: pkg.frameworks,
          framework: Array.isArray(pkg.frameworks) ? pkg.frameworks[0] : undefined,
          detectedType: "frontend",
          type: "frontend",
        },
      },
      "frontend",
    );

    ctx.addToGroup("frontend", packageName, frontendSummary);

    processFrontendComponents(pkg, packageName, packageRoot, ctx);
    processFrontendRoutes(pkg, packageName, packageRoot, ctx);
  });
};
