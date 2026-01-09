/**
 * @module ArchitectureDiagram/grouping/processors/capabilitiesProcessor
 * Processes capabilities from project data.
 */

import { enrichDataForGrouping } from "../helpers";
import type { Processor, ProcessorContext } from "./types";

/**
 * Records a single capability entry.
 */
const recordCapability = (raw: any, fallbackName: string, idx: number, ctx: ProcessorContext) => {
  if (!raw && typeof raw !== "string") return;
  const capabilityData = typeof raw === "string" ? { name: raw } : { ...raw };
  const capabilityName = String(capabilityData.name || fallbackName || `Capability ${idx + 1}`);

  if (!capabilityData.description && capabilityData.metadata?.description) {
    capabilityData.description = capabilityData.metadata.description;
  }

  if (!capabilityData.gherkin) {
    const fromMetadata = capabilityData.metadata?.gherkinSpec || capabilityData.metadata?.gherkin;
    if (typeof fromMetadata === "string" && fromMetadata.trim().length > 0) {
      capabilityData.gherkin = fromMetadata;
    }
  }

  const enriched = enrichDataForGrouping(
    {
      ...capabilityData,
      name: capabilityName,
    },
    "capability",
  );
  ctx.addToGroup("capability", capabilityName, enriched);
};

/**
 * Processes capabilities from project data.
 * Handles both array and object formats.
 */
export const processCapabilities: Processor = (projectData, ctx) => {
  const capabilitySource = projectData?.spec?.capabilities ?? projectData?.capabilities ?? [];

  if (Array.isArray(capabilitySource)) {
    capabilitySource.forEach((capability, index) => {
      recordCapability(capability, `Capability ${index + 1}`, index, ctx);
    });
  } else if (capabilitySource && typeof capabilitySource === "object") {
    Object.entries(capabilitySource as Record<string, any>).forEach(([key, capability], index) => {
      recordCapability(capability, key || `Capability ${index + 1}`, index, ctx);
    });
  }
};
