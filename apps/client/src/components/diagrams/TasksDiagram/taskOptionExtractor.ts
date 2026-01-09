/**
 * Utilities for extracting task and group options from task groups.
 */

import type { GroupIssueOption, IssueGroupOption } from "@/components/modals/entityTypes";
import type { NormalizedTask, NormalizedTaskGroup } from "./types";

interface TaskGroupOptionsResult {
  openTaskOptions: GroupIssueOption[];
  groupSelectionOptions: IssueGroupOption[];
}

/**
 * Add a group to the selection list if not already seen.
 */
function addGroupToSelection(
  group: NormalizedTaskGroup,
  seenGroups: Set<string>,
  selection: IssueGroupOption[],
): void {
  if (group.type !== "group") return;

  const groupIdentifier = group.rawId ?? group.id;
  if (groupIdentifier && !seenGroups.has(groupIdentifier)) {
    selection.push({ id: groupIdentifier, name: group.name });
    seenGroups.add(groupIdentifier);
    seenGroups.add(group.id);
  }
}

/**
 * Build option ID from task data.
 */
function buildTaskOptionId(task: NormalizedTask, groupId: string): string {
  return String(task.rawId || task.slug || `${groupId}-${task.nodeId}`);
}

/**
 * Build a single task option.
 */
function buildTaskOption(
  task: NormalizedTask,
  group: NormalizedTaskGroup,
  seenGroups: Set<string>,
  selection: IssueGroupOption[],
): GroupIssueOption {
  const option: GroupIssueOption = {
    id: buildTaskOptionId(task, group.id),
    name: task.name,
  };

  if (group.type === "group") {
    const groupIdentifier = group.rawId ?? group.id;
    option.groupId = groupIdentifier;
    option.groupName = group.name;

    if (groupIdentifier && !seenGroups.has(groupIdentifier)) {
      selection.push({ id: groupIdentifier, name: group.name });
      seenGroups.add(groupIdentifier);
      seenGroups.add(group.id);
    }
  }

  if (task.groupId && !option.groupId) {
    option.groupId = task.groupId;
  }

  if (task.groupName && !option.groupName) {
    option.groupName = task.groupName;
  }

  if (task.status) {
    option.status = task.status;
  }

  return option;
}

/**
 * Process all tasks in a group and add to options.
 */
function processGroupTasks(
  group: NormalizedTaskGroup,
  seenTasks: Set<string>,
  seenGroups: Set<string>,
  options: GroupIssueOption[],
  selection: IssueGroupOption[],
): void {
  group.tasks.forEach((task) => {
    if (task.completed) {
      return;
    }

    const optionId = buildTaskOptionId(task, group.id);
    const dedupeKey = `${group.id}-${optionId}`;
    if (seenTasks.has(dedupeKey)) {
      return;
    }

    seenTasks.add(dedupeKey);
    options.push(buildTaskOption(task, group, seenGroups, selection));
  });
}

/**
 * Extract task and group options from normalized task groups.
 */
export function extractTaskGroupOptions(taskGroups: NormalizedTaskGroup[]): TaskGroupOptionsResult {
  const options: GroupIssueOption[] = [];
  const selection: IssueGroupOption[] = [];
  const seenTasks = new Set<string>();
  const seenGroups = new Set<string>();

  taskGroups.forEach((group) => {
    addGroupToSelection(group, seenGroups, selection);
    processGroupTasks(group, seenTasks, seenGroups, options, selection);
  });

  selection.sort((a, b) => a.name.localeCompare(b.name));

  return { openTaskOptions: options, groupSelectionOptions: selection };
}
