/**
 * @module ArchitectureDiagram/grouping/computeGroupedComponents
 * Computes grouped components from project data for architecture diagram display.
 * Handles services, databases, frontends, capabilities, flows, groups, and tasks.
 */

import {
  TYPE_CONFIG,
  enrichDataForGrouping,
  getTypeConfig,
  resolveArtifactId,
  shouldExcludeFromDiagram,
} from "./helpers";
import {
  processCapabilities,
  processComponents,
  processDatabases,
  processFlows,
  processFrontendPackages,
  processGroups,
  processRoutes,
  processServices,
  processStandaloneTasks,
} from "./processors";
import type { ProcessorContext } from "./processors/types";
import type { GroupedComponentGroup } from "./types";

/**
 * Creates a task registration function with deduplication.
 */
const createTaskRegistrar = (
  recordedTaskKeys: Set<string>,
  addToGroup: ProcessorContext["addToGroup"],
  isRemovedItem: ProcessorContext["isRemovedItem"],
) => {
  return (
    rawTask: any,
    fallbackName: string,
    context?: { groupId?: string; groupName?: string },
  ) => {
    if (!rawTask && typeof rawTask !== "string") return;

    const taskData = typeof rawTask === "string" ? { name: rawTask } : { ...rawTask };
    if (shouldExcludeFromDiagram(taskData, isRemovedItem)) return;

    const metadata = (taskData.metadata ?? {}) as Record<string, unknown>;
    const identifierCandidates = [
      taskData.id,
      metadata.id,
      taskData.artifactId,
      metadata.artifactId,
      metadata.artifact_id,
    ]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);

    const dedupeKey = identifierCandidates[0] || fallbackName;
    if (dedupeKey && recordedTaskKeys.has(dedupeKey)) return;

    const taskName =
      (typeof taskData.name === "string" && taskData.name.trim().length > 0
        ? taskData.name.trim()
        : undefined) ??
      dedupeKey ??
      fallbackName ??
      `Task ${recordedTaskKeys.size + 1}`;

    const statusCandidates = [taskData.status, taskData.state, metadata.status, metadata.state]
      .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
      .filter(Boolean);

    const completedFlag =
      taskData.completed === true ||
      taskData.done === true ||
      taskData.isCompleted === true ||
      metadata.completed === true ||
      statusCandidates.includes("completed");

    if (completedFlag) return;

    const enrichedTask = enrichDataForGrouping(
      {
        ...taskData,
        name: taskName,
        metadata: {
          ...(metadata || {}),
          ...(context?.groupId ? { groupId: context.groupId } : {}),
          ...(context?.groupName ? { groupName: context.groupName } : {}),
        },
      },
      "task",
    );

    addToGroup("task", taskName, enrichedTask);
    if (dedupeKey) recordedTaskKeys.add(dedupeKey);
  };
};

/**
 * Creates the processor context with shared state and utilities.
 */
const createProcessorContext = (removedArtifactIds: Set<string>): ProcessorContext => {
  const groups = new Map<string, GroupedComponentGroup>();
  const recordedTaskKeys = new Set<string>();

  const isRemovedItem = (item: unknown): boolean => {
    if (!removedArtifactIds || removedArtifactIds.size === 0) return false;
    const candidateId = resolveArtifactId(item);
    return candidateId ? removedArtifactIds.has(candidateId) : false;
  };

  const ensureGroup = (type: string): GroupedComponentGroup => {
    const config = getTypeConfig(type)!;
    if (!groups.has(config.label)) {
      const baseGroup: GroupedComponentGroup = {
        key: type,
        label: config.label,
        type,
        layout: config.layout,
        items: [],
      };
      if (config.treeMode !== undefined) {
        baseGroup.treeMode = config.treeMode;
      }
      groups.set(config.label, baseGroup);
    }
    return groups.get(config.label)!;
  };

  const addToGroup = (type: string, name: string, data: any) => {
    if (!type) return;
    if (isRemovedItem(data)) return;
    const group = ensureGroup(type);
    group.items.push({ name, data });
  };

  const registerTask = createTaskRegistrar(recordedTaskKeys, addToGroup, isRemovedItem);

  return {
    groups,
    recordedTaskKeys,
    removedArtifactIds,
    isRemovedItem,
    ensureGroup,
    addToGroup,
    registerTask,
  };
};

/**
 * Deduplicates groups by display name and filters out component groups.
 */
const deduplicateGroups = (groups: Map<string, GroupedComponentGroup>): GroupedComponentGroup[] => {
  return Array.from(groups.values())
    .map((group) => {
      const seenDisplayNames = new Set<string>();
      const uniqueItems = group.items.filter(({ name, data }) => {
        const displayName = data.name || name;
        if (!displayName) return false;
        if (seenDisplayNames.has(displayName)) return false;
        seenDisplayNames.add(displayName);
        return true;
      });
      return { ...group, items: uniqueItems };
    })
    .filter((group) => group.type !== "component");
};

/**
 * Sorts groups by item count descending, then by label alphabetically.
 */
const sortGroups = (groups: GroupedComponentGroup[]): GroupedComponentGroup[] => {
  return groups.sort((a, b) => {
    const diff = b.items.length - a.items.length;
    return diff !== 0 ? diff : a.label.localeCompare(b.label);
  });
};

/**
 * Computes grouped architecture components from project data.
 * Groups components by type (services, databases, frontends, etc.) and
 * deduplicates items by display name.
 *
 * @param projectData - Raw project data containing spec information
 * @param removedArtifactIds - Set of artifact IDs that should be filtered out
 * @returns Array of grouped component groups for rendering
 */
export const computeGroupedComponents = (
  projectData: any,
  removedArtifactIds: Set<string> = new Set(),
): GroupedComponentGroup[] => {
  const ctx = createProcessorContext(removedArtifactIds);

  if (projectData) {
    processServices(projectData, ctx);
    processDatabases(projectData, ctx);
    processComponents(projectData, ctx);
    processRoutes(projectData, ctx);
    processFrontendPackages(projectData, ctx);
  }

  processCapabilities(projectData, ctx);
  processFlows(projectData, ctx);
  processGroups(projectData, ctx);
  processStandaloneTasks(projectData, ctx);

  // Ensure all type groups exist (except component)
  Object.keys(TYPE_CONFIG)
    .filter((type) => type !== "component")
    .forEach((type) => ctx.ensureGroup(type));

  return sortGroups(deduplicateGroups(ctx.groups));
};
