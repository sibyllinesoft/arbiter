/**
 * @module ArchitectureDiagram/grouping/processors/routesProcessor
 * Processes routes from project data.
 */

import { getComponentType, shouldExcludeFromDiagram } from "../helpers";
import type { Processor, ProcessorContext } from "./types";

/**
 * Processes UI routes from project data.
 */
export const processRoutes: Processor = (projectData, ctx) => {
  const routes = projectData?.spec?.ui?.routes || projectData?.ui?.routes || [];

  (routes as any[]).forEach((route) => {
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
    if (shouldExcludeFromDiagram(routeData, ctx.isRemovedItem)) return;
    const type = getComponentType(routeData, name);
    ctx.addToGroup(type, name, routeData);
  });
};
