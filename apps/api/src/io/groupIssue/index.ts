import { type GroupArtifact, type GroupSpec, type TaskSpec, buildGroups } from "./groupBuilder";
/**
 * Group/Issue Spec Builder - Modular Implementation
 *
 * Builds group and task specifications from artifacts.
 */
import {
  coerceStringArray,
  collectAliasKeys,
  normalizeCandidate,
  registerKeys,
  sortTasks,
  toOptionalString,
} from "./helpers";
import { type TaskArtifact, buildTasks } from "./taskBuilder";

export { coerceStringArray } from "./helpers";
export type { GroupSpec, TaskSpec, GroupArtifact, TaskArtifact };

type Artifact = GroupArtifact | TaskArtifact;

/** Link tasks to their parent groups */
function linkTasksToGroups(
  tasks: TaskSpec[],
  groups: GroupSpec[],
  groupMatchMap: Map<string, GroupSpec>,
): void {
  tasks.forEach((task) => {
    const metadata = (task.metadata ?? {}) as Record<string, unknown>;
    const candidates = [
      task.groupId,
      task.groupName,
      toOptionalString(metadata.groupId),
      toOptionalString(metadata.group),
      toOptionalString(metadata.groupSlug),
      toOptionalString(metadata.parentGroup),
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      const normalized = normalizeCandidate(candidate);
      if (normalized && groupMatchMap.has(normalized)) {
        const group = groupMatchMap.get(normalized)!;
        if (!group.tasks.some((existing) => existing.id === task.id)) {
          group.tasks.push(task);
        }
        if (!task.groupId) {
          task.groupId = group.id;
        }
        if (!task.groupName) {
          task.groupName = group.name;
        }
        break;
      }
    }
  });
}

/** Link referenced tasks to groups by task reference */
function linkReferencedTasksToGroups(
  tasks: TaskSpec[],
  groups: GroupSpec[],
  taskMatchMap: Map<string, TaskSpec>,
): void {
  // Build extended task match keys
  const taskMatchKeys = new Map<string, TaskSpec>();
  tasks.forEach((task) => {
    const keys = [task.id, task.slug, task.name, task.groupId, task.groupName];
    keys.forEach((key) => {
      const normalized = normalizeCandidate(key);
      if (normalized && !taskMatchKeys.has(normalized)) {
        taskMatchKeys.set(normalized, task);
      }
    });
    const metadata = (task.metadata ?? {}) as Record<string, unknown>;
    registerKeys(taskMatchKeys, collectAliasKeys(metadata.aliases), task);
  });

  // Link referenced tasks
  groups.forEach((group) => {
    const metadata = (group.metadata ?? {}) as Record<string, unknown>;
    const referenced = Array.isArray(metadata.tasks)
      ? (metadata.tasks as unknown[])
          .map((task) => (typeof task === "string" ? task.trim() : ""))
          .filter((task): task is string => task.length > 0)
      : coerceStringArray(metadata.tasks);

    referenced.forEach((ref) => {
      const normalized = normalizeCandidate(ref);
      if (!normalized) return;
      const task = taskMatchKeys.get(normalized) ?? taskMatchMap.get(normalized);
      if (task && !group.tasks.some((existing) => existing.id === task.id)) {
        group.tasks.push(task);
        if (!task.groupId) {
          task.groupId = group.id;
        }
        if (!task.groupName) {
          task.groupName = group.name;
        }
      }
    });

    group.tasks.sort(sortTasks);
  });
}

/** Build group and task specifications from artifacts */
export function buildGroupIssueSpec(artifacts: Artifact[]): {
  groups: GroupSpec[];
  tasks: TaskSpec[];
} {
  const groupArtifacts = artifacts.filter(
    (artifact): artifact is GroupArtifact =>
      artifact !== null && typeof artifact === "object" && artifact.type === "group",
  );
  const taskArtifacts = artifacts.filter(
    (artifact): artifact is TaskArtifact =>
      artifact !== null && typeof artifact === "object" && artifact.type === "task",
  );

  const groupMatchMap = new Map<string, GroupSpec>();
  const taskMatchMap = new Map<string, TaskSpec>();

  const groups = buildGroups(groupArtifacts, groupMatchMap);
  const tasks = buildTasks(taskArtifacts, taskMatchMap);

  // Link tasks to groups
  linkTasksToGroups(tasks, groups, groupMatchMap);
  linkReferencedTasksToGroups(tasks, groups, taskMatchMap);

  // Sort groups and tasks
  groups.sort((a, b) => {
    const nameA = toOptionalString(a.name) ?? "";
    const nameB = toOptionalString(b.name) ?? "";
    return nameA.localeCompare(nameB);
  });

  tasks.sort(sortTasks);

  return { groups, tasks };
}
