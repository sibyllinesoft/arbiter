/**
 * @module ArchitectureDiagram/grouping/processors
 * Exports all component processors for the architecture diagram.
 */

export { processServices, processDatabases, processComponents } from "./servicesProcessor";
export { processRoutes } from "./routesProcessor";
export { processFrontendPackages } from "./frontendProcessor";
export { processCapabilities } from "./capabilitiesProcessor";
export { processFlows } from "./flowsProcessor";
export { processGroups } from "./groupsProcessor";
export { processStandaloneTasks } from "./tasksProcessor";
export type { ProcessorContext, Processor } from "./types";
