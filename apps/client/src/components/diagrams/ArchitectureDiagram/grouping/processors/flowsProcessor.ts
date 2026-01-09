/**
 * @module ArchitectureDiagram/grouping/processors/flowsProcessor
 * Processes flows from project data.
 */

import { enrichDataForGrouping } from "../helpers";
import type { Processor, ProcessorContext } from "./types";

/**
 * Normalizes flows source to array format.
 */
const normalizeFlowsSource = (source: unknown): any[] => {
  if (Array.isArray(source)) return source;
  if (source && typeof source === "object") {
    return Object.values(source as Record<string, any>);
  }
  return [];
};

/**
 * Processes flows from project data.
 */
export const processFlows: Processor = (projectData, ctx) => {
  const flowsSource = projectData?.spec?.flows ?? projectData?.flows ?? [];
  const flowsArray = normalizeFlowsSource(flowsSource);

  flowsArray.forEach((flow, index) => {
    if (!flow && typeof flow !== "string") return;
    const flowData = typeof flow === "string" ? { name: flow } : { ...flow };
    const flowName = String(flowData.name || flowData.id || `Flow ${index + 1}`);
    const enriched = enrichDataForGrouping(
      {
        ...flowData,
        name: flowName,
      },
      "flow",
    );
    ctx.addToGroup("flow", flowName, enriched);
  });
};
