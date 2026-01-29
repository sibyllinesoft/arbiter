/**
 * @module ArchitectureDiagram/grouping/processors/servicesProcessor
 * Processes services, databases, and components from project data.
 */

import { enrichDataForGrouping, getComponentType, shouldExcludeFromDiagram } from "../helpers";
import type { Processor, ProcessorContext } from "./types";

/**
 * Processes packages from project data.
 */
export const processServices: Processor = (projectData, ctx) => {
  const packages = projectData?.spec?.packages || projectData?.packages || {};

  Object.entries(packages).forEach(([name, data]) => {
    if (!data) return;
    if (shouldExcludeFromDiagram(data, ctx.isRemovedItem)) return;
    const type = getComponentType(data, name);
    const enrichedData = enrichDataForGrouping(data, type);
    ctx.addToGroup(type, name, enrichedData);
  });
};

/**
 * Processes databases from project data.
 */
export const processDatabases: Processor = (projectData, ctx) => {
  const databases = projectData?.spec?.databases || projectData?.databases || {};

  Object.entries(databases).forEach(([name, data]) => {
    if (!data) return;
    const databaseData = enrichDataForGrouping(data, "database");
    if (shouldExcludeFromDiagram(databaseData, ctx.isRemovedItem)) return;
    ctx.addToGroup("database", name, databaseData);
  });
};

/**
 * Processes generic components from project data.
 */
export const processComponents: Processor = (projectData, ctx) => {
  const components = projectData?.spec?.components || projectData?.components || {};

  Object.entries(components).forEach(([name, data]) => {
    if (!data) return;
    if (shouldExcludeFromDiagram(data, ctx.isRemovedItem)) return;
    const type = getComponentType(data, name);
    const enrichedData = enrichDataForGrouping(data, type);
    ctx.addToGroup(type, name, enrichedData);
  });
};
