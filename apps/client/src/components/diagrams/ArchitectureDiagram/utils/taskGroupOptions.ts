/**
 * Utilities for extracting task and group options from project data.
 */

import type { GroupIssueOption, IssueGroupOption } from "@/components/modals/entityTypes";

/**
 * Extract artifact ID from an artifact object.
 */
function extractArtifactId(artifact: Record<string, unknown>): string | null {
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
        return trimmed;
      }
    }
  }
  return null;
}

/**
 * Collect all existing artifact IDs from project data.
 */
export function collectExistingArtifactIds(projectData: any): Set<string> {
  const existingIds = new Set<string>();
  const artifactArray = Array.isArray(projectData?.artifacts)
    ? (projectData.artifacts as Array<unknown>)
    : [];

  artifactArray.forEach((artifactValue) => {
    if (!artifactValue || typeof artifactValue !== "object") {
      return;
    }
    const artifact = artifactValue as Record<string, unknown>;
    const id = extractArtifactId(artifact);
    if (id) {
      existingIds.add(id);
    }
  });

  return existingIds;
}

/**
 * Filter optimistic removals to only include IDs that still exist.
 */
export function filterOptimisticRemovals(
  prev: Set<string>,
  existingIds: Set<string>,
): { next: Set<string>; shouldUpdate: boolean } {
  if (prev.size === 0) {
    return { next: prev, shouldUpdate: false };
  }
  let shouldUpdate = false;
  const next = new Set<string>();
  prev.forEach((id) => {
    if (existingIds.has(id)) {
      next.add(id);
    } else {
      shouldUpdate = true;
    }
  });
  return { next, shouldUpdate };
}

interface GroupEntry {
  key: string;
  value: any;
  index: number;
}

interface TaskGroupOptionsResult {
  openTaskOptions: GroupIssueOption[];
  groupSelectionOptions: IssueGroupOption[];
}

/**
 * Convert group source to normalized entries array.
 */
function normalizeGroupSource(groupSource: unknown): GroupEntry[] {
  const entries: GroupEntry[] = [];

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
}

/**
 * Extract group ID and name from raw group data.
 */
function extractGroupInfo(
  groupData: Record<string, unknown>,
  key: string,
  index: number,
): { groupId: string; groupName: string } {
  const groupIdRaw = groupData.id ?? key ?? `group-${index + 1}`;
  const groupId = String(groupIdRaw ?? "").trim() || `group-${index + 1}`;
  const groupName =
    String(groupData.name ?? groupId ?? `Group ${index + 1}`).trim() || `Group ${index + 1}`;
  return { groupId, groupName };
}

/**
 * Convert tasks source to normalized array.
 */
function normalizeTasksArray(tasksSource: unknown): unknown[] {
  if (Array.isArray(tasksSource)) {
    return tasksSource;
  }
  if (tasksSource && typeof tasksSource === "object") {
    return Object.values(tasksSource as Record<string, any>);
  }
  return [];
}

/**
 * Check if a task is marked as completed.
 */
function isTaskCompleted(taskData: Record<string, unknown>): boolean {
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
}

/**
 * Extract status string from task data.
 */
function extractTaskStatus(taskData: Record<string, unknown>): string | undefined {
  const metadata = (taskData.metadata ?? {}) as Record<string, unknown>;
  const statusCandidates = [taskData.status, taskData.state, metadata.status, metadata.state]
    .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
    .filter(Boolean);

  return statusCandidates[0] || (typeof taskData.status === "string" ? taskData.status : undefined);
}

/**
 * Process a single task and add to options if valid.
 */
function processTask(
  task: unknown,
  taskIndex: number,
  groupId: string,
  groupName: string,
  seenTasks: Set<string>,
  options: GroupIssueOption[],
): void {
  if (!task && typeof task !== "string") return;

  const taskData: Record<string, unknown> =
    typeof task === "string" ? { name: task } : { ...(task as object) };
  const taskIdRaw = taskData.id ?? `${groupId}-${taskIndex + 1}`;
  const taskId = String(taskIdRaw ?? "").trim();
  if (!taskId) return;

  const dedupeKey = `${groupId}-${taskId}`;
  if (seenTasks.has(dedupeKey)) {
    return;
  }
  seenTasks.add(dedupeKey);

  const taskName = String(taskData.name ?? taskId ?? `Task ${taskIndex + 1}`).trim() || taskId;

  if (isTaskCompleted(taskData)) {
    return;
  }

  options.push({
    id: taskId,
    name: taskName,
    groupId,
    groupName,
    status: extractTaskStatus(taskData),
    completed: false,
  });
}

/**
 * Process a single group entry.
 */
function processGroupEntry(
  entry: GroupEntry,
  seenGroups: Set<string>,
  seenTasks: Set<string>,
  selection: IssueGroupOption[],
  options: GroupIssueOption[],
): void {
  const { key, value, index } = entry;
  if (!value && typeof value !== "string") return;

  const groupData = typeof value === "string" ? { id: key, name: value } : { ...value };
  const { groupId, groupName } = extractGroupInfo(groupData, key, index);

  if (!seenGroups.has(groupId)) {
    selection.push({ id: groupId, name: groupName });
    seenGroups.add(groupId);
  }

  const tasksArray = normalizeTasksArray(groupData.tasks);
  tasksArray.forEach((task, taskIndex) => {
    processTask(task, taskIndex, groupId, groupName, seenTasks, options);
  });
}

/**
 * Extract task and group options from project data.
 */
export function extractTaskGroupOptions(projectData: any): TaskGroupOptionsResult {
  if (!projectData) {
    return {
      openTaskOptions: [],
      groupSelectionOptions: [],
    };
  }

  const groupSource = projectData?.spec?.groups ?? projectData?.groups ?? [];
  const groupEntries = normalizeGroupSource(groupSource);

  const options: GroupIssueOption[] = [];
  const selection: IssueGroupOption[] = [];
  const seenGroups = new Set<string>();
  const seenTasks = new Set<string>();

  groupEntries.forEach((entry) => {
    processGroupEntry(entry, seenGroups, seenTasks, selection, options);
  });

  return { openTaskOptions: options, groupSelectionOptions: selection };
}
