/**
 * @module ArchitectureDiagram/hooks/architectureDiagramUtils
 * Utility functions for the useArchitectureDiagramData hook.
 */

import type { GroupIssueOption, IssueGroupOption } from "@/components/modals/entityTypes";

/**
 * Result of computing task options from project data.
 */
export interface TaskOptionsResult {
  openTaskOptions: GroupIssueOption[];
  groupSelectionOptions: IssueGroupOption[];
}

/**
 * Extracts entries from a group source (array or object).
 */
const extractGroupEntries = (
  groupSource: unknown,
): Array<{ key: string; value: any; index: number }> => {
  const entries: Array<{ key: string; value: any; index: number }> = [];

  if (Array.isArray(groupSource)) {
    groupSource.forEach((value, index) => {
      const key =
        (value && typeof value === "object" && (value.id || value.name)) || `group-${index + 1}`;
      entries.push({ key: String(key), value, index });
    });
  } else if (groupSource && typeof groupSource === "object") {
    Object.entries(groupSource as Record<string, any>).forEach(([key, value], index) => {
      entries.push({ key, value, index });
    });
  }

  return entries;
};

/**
 * Determines if a task is completed based on various status indicators.
 */
const isTaskCompleted = (taskData: Record<string, any>): boolean => {
  const metadata = (taskData.metadata ?? {}) as Record<string, unknown>;
  const statusCandidates = [taskData.status, taskData.state, metadata.status, metadata.state]
    .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
    .filter(Boolean);

  return (
    taskData.completed === true ||
    taskData.done === true ||
    taskData.isCompleted === true ||
    metadata.completed === true ||
    statusCandidates.includes("completed")
  );
};

/**
 * Gets status candidates from task data.
 */
const getStatusCandidates = (taskData: Record<string, any>): string[] => {
  const metadata = (taskData.metadata ?? {}) as Record<string, unknown>;
  return [taskData.status, taskData.state, metadata.status, metadata.state]
    .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
    .filter(Boolean);
};

/**
 * Processes a single task and adds it to options if valid.
 */
const processTask = (
  task: any,
  taskIndex: number,
  groupId: string,
  groupName: string,
  seenTasks: Set<string>,
  options: GroupIssueOption[],
): void => {
  if (!task && typeof task !== "string") return;

  const taskData = typeof task === "string" ? { name: task } : { ...task };
  const taskIdRaw = taskData.id ?? `${groupId}-${taskIndex + 1}`;
  const taskId = String(taskIdRaw ?? "").trim();
  if (!taskId) return;

  const dedupeKey = `${groupId}-${taskId}`;
  if (seenTasks.has(dedupeKey)) return;
  seenTasks.add(dedupeKey);

  if (isTaskCompleted(taskData)) return;

  const taskName = String(taskData.name ?? taskId ?? `Task ${taskIndex + 1}`).trim() || taskId;
  const statusCandidates = getStatusCandidates(taskData);

  options.push({
    id: taskId,
    name: taskName,
    groupId,
    groupName,
    status:
      statusCandidates[0] || (typeof taskData.status === "string" ? taskData.status : undefined),
    completed: false,
  });
};

/**
 * Processes a single group entry and extracts its tasks.
 */
const processGroupEntry = (
  entry: { key: string; value: any; index: number },
  seenGroups: Set<string>,
  seenTasks: Set<string>,
  selection: IssueGroupOption[],
  options: GroupIssueOption[],
): void => {
  const { key, value, index } = entry;
  if (!value && typeof value !== "string") return;

  const groupData = typeof value === "string" ? { id: key, name: value } : { ...value };
  const groupIdRaw = groupData.id ?? key ?? `group-${index + 1}`;
  const groupId = String(groupIdRaw ?? "").trim() || `group-${index + 1}`;
  const groupName =
    String(groupData.name ?? groupId ?? `Group ${index + 1}`).trim() || `Group ${index + 1}`;

  if (!seenGroups.has(groupId)) {
    selection.push({ id: groupId, name: groupName });
    seenGroups.add(groupId);
  }

  const tasksSource = groupData.tasks ?? [];
  const tasksArray = Array.isArray(tasksSource)
    ? tasksSource
    : tasksSource && typeof tasksSource === "object"
      ? Object.values(tasksSource as Record<string, any>)
      : [];

  tasksArray.forEach((task, taskIndex) => {
    processTask(task, taskIndex, groupId, groupName, seenTasks, options);
  });
};

/**
 * Computes task options from project data.
 */
export const computeTaskOptions = (projectData: any): TaskOptionsResult => {
  if (!projectData) {
    return { openTaskOptions: [], groupSelectionOptions: [] };
  }

  const groupSource = projectData?.spec?.groups ?? projectData?.groups ?? [];
  const groupEntries = extractGroupEntries(groupSource);

  const options: GroupIssueOption[] = [];
  const selection: IssueGroupOption[] = [];
  const seenGroups = new Set<string>();
  const seenTasks = new Set<string>();

  groupEntries.forEach((entry) => {
    processGroupEntry(entry, seenGroups, seenTasks, selection, options);
  });

  return { openTaskOptions: options, groupSelectionOptions: selection };
};

/**
 * Extracts artifact IDs from project data artifacts array.
 */
const extractExistingArtifactIds = (projectData: any): Set<string> => {
  const existingIds = new Set<string>();
  const artifactArray = Array.isArray(projectData?.artifacts)
    ? (projectData.artifacts as Array<unknown>)
    : [];

  artifactArray.forEach((artifactValue) => {
    if (!artifactValue || typeof artifactValue !== "object") return;

    const artifact = artifactValue as Record<string, unknown>;
    const metadataValue = artifact["metadata"];
    const metadata =
      metadataValue && typeof metadataValue === "object"
        ? (metadataValue as Record<string, unknown>)
        : undefined;

    const candidates = [
      artifact["id"],
      artifact["artifactId"],
      artifact["artifact_id"],
      metadata?.["artifactId"],
      metadata?.["artifact_id"],
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (trimmed) {
          existingIds.add(trimmed);
          break;
        }
      }
    }
  });

  return existingIds;
};

/**
 * Syncs optimistic removals with actual project data.
 * Returns a new set if changes are needed, otherwise returns the original.
 */
export const syncOptimisticRemovals = (
  projectData: any,
  optimisticRemovals: Set<string>,
): Set<string> => {
  if (!projectData || optimisticRemovals.size === 0) {
    return optimisticRemovals;
  }

  const existingIds = extractExistingArtifactIds(projectData);

  let shouldUpdate = false;
  const next = new Set<string>();

  optimisticRemovals.forEach((id) => {
    if (existingIds.has(id)) {
      next.add(id);
    } else {
      shouldUpdate = true;
    }
  });

  return shouldUpdate ? next : optimisticRemovals;
};
