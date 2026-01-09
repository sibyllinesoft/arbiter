/**
 * @module ArchitectureDiagram/grouping/processors/groupsProcessor
 * Processes groups and their tasks from project data.
 */

import { enrichDataForGrouping } from "../helpers";
import type { Processor, ProcessorContext } from "./types";

/**
 * Normalizes tasks source to array format.
 */
const normalizeTasksArray = (source: unknown): any[] => {
  if (Array.isArray(source)) return source;
  if (source && typeof source === "object") {
    return Object.values(source as Record<string, any>);
  }
  return [];
};

/**
 * Converts group source to normalized entries.
 */
const normalizeGroupEntries = (
  source: unknown,
): Array<{ key: string; value: any; index: number }> => {
  const entries: Array<{ key: string; value: any; index: number }> = [];

  if (Array.isArray(source)) {
    source.forEach((value, index) => {
      const key =
        (value && typeof value === "object" && (value.id || value.name)) || `group-${index + 1}`;
      entries.push({ key: String(key), value, index });
    });
  } else if (source && typeof source === "object") {
    Object.entries(source as Record<string, any>).forEach(([key, value], index) => {
      entries.push({ key, value, index });
    });
  }

  return entries;
};

/**
 * Processes groups and their tasks from project data.
 */
export const processGroups: Processor = (projectData, ctx) => {
  const groupSource = projectData?.spec?.groups ?? projectData?.groups ?? [];
  const groupEntries = normalizeGroupEntries(groupSource);

  groupEntries.forEach(({ key, value, index }) => {
    if (!value && typeof value !== "string") return;
    const groupData = typeof value === "string" ? { id: key, name: value } : { ...value };
    const groupId = String(groupData.id || key || `group-${index + 1}`);
    const groupName = String(groupData.name || groupId || `Group ${index + 1}`);

    const enrichedGroup = enrichDataForGrouping(
      {
        ...groupData,
        id: groupId,
        name: groupName,
        metadata: {
          ...(groupData.metadata || {}),
          groupId,
        },
      },
      "group",
    );
    ctx.addToGroup("group", groupName, enrichedGroup);

    // Process tasks within this group
    const tasksArray = normalizeTasksArray(groupData.tasks);
    tasksArray.forEach((task, taskIndex) => {
      ctx.registerTask(task, `${groupName} Task ${taskIndex + 1}`, { groupId, groupName });
    });
  });
};
