/**
 * @module ArchitectureDiagram/grouping/processors/tasksProcessor
 * Processes standalone tasks from project data.
 */

import type { Processor, ProcessorContext } from "./types";

/**
 * Normalizes task collection to array format.
 */
const normalizeTaskCollection = (source: unknown): any[] => {
  if (Array.isArray(source)) return source;
  if (source && typeof source === "object") {
    return Object.values(source as Record<string, any>);
  }
  return [];
};

/**
 * Processes standalone tasks from project data.
 * Handles tasks at both spec level and project level.
 */
export const processStandaloneTasks: Processor = (projectData, ctx) => {
  const standaloneSpecTasks = normalizeTaskCollection(projectData?.spec?.tasks);
  standaloneSpecTasks.forEach((task, index) => {
    ctx.registerTask(task, `Task ${index + 1}`);
  });

  const projectLevelTasks = normalizeTaskCollection(projectData?.tasks);
  projectLevelTasks.forEach((task, index) => {
    ctx.registerTask(task, `Task ${standaloneSpecTasks.length + index + 1}`);
  });
};
