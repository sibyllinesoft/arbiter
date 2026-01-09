import type { TaskSpec } from "./groupBuilder";
/**
 * Task building logic for group/issue spec
 */
import {
  COMPLETED_STATUS_TOKENS,
  coerceStringArray,
  collectAliasKeys,
  registerKeys,
  slugifyValue,
  toOptionalBoolean,
  toOptionalString,
} from "./helpers";

export type TaskArtifact = {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  type: string;
};

export function buildTasks(
  taskArtifacts: TaskArtifact[],
  taskMatchMap: Map<string, TaskSpec>,
): TaskSpec[] {
  const tasks: TaskSpec[] = [];

  taskArtifacts.forEach((artifact) => {
    const metadata: Record<string, unknown> = {
      ...(artifact.metadata ?? {}),
    };

    const slug = slugifyValue(
      toOptionalString(metadata.slug) ?? artifact.name,
      `task-${artifact.id}`,
    );
    const id = toOptionalString(metadata.id) ?? slug;

    metadata.id = id;
    metadata.slug = slug;
    metadata.artifactId = artifact.id;

    const status = toOptionalString(metadata.status);
    const assignee = toOptionalString(metadata.assignee ?? metadata.owner);
    const priority = toOptionalString(metadata.priority);
    const dependencyCandidates = [
      metadata.dependsOn,
      metadata.depends_on,
      metadata.dependencies,
      metadata.blockedBy,
      metadata.blocked_by,
    ];

    const dependsOn = Array.from(
      new Set(
        dependencyCandidates
          .flatMap((entry) => coerceStringArray(entry))
          .filter((dep): dep is string => dep.length > 0),
      ),
    );

    const groupCandidates = [
      toOptionalString(metadata.groupId),
      toOptionalString(metadata.group),
      toOptionalString(metadata.groupSlug),
      toOptionalString(metadata.parentGroup),
    ].filter((candidate): candidate is string => Boolean(candidate));

    const groupName = toOptionalString(metadata.groupName) ?? groupCandidates[0];

    const completedFlag =
      toOptionalBoolean(metadata.completed ?? metadata.done ?? metadata.isCompleted) ??
      (status ? COMPLETED_STATUS_TOKENS.has(status.toLowerCase()) : undefined);

    const task: TaskSpec = {
      id,
      slug,
      artifactId: artifact.id,
      name: artifact.name,
      ...(artifact.description ? { description: artifact.description } : {}),
      ...(status ? { status } : {}),
      ...(assignee ? { assignee } : {}),
      ...(priority ? { priority } : {}),
      ...(dependsOn.length ? { dependsOn } : {}),
      ...(groupCandidates[0] ? { groupId: groupCandidates[0] } : {}),
      ...(groupName ? { groupName } : {}),
      ...(completedFlag !== undefined ? { completed: completedFlag } : {}),
      metadata,
    };

    tasks.push(task);

    registerKeys(
      taskMatchMap,
      [
        id,
        slug,
        artifact.name,
        metadata.slug as string,
        metadata.id as string,
        groupName,
        ...groupCandidates,
      ],
      task,
    );
    if ("order" in metadata) {
      delete metadata.order;
    }
    registerKeys(taskMatchMap, collectAliasKeys(metadata.aliases), task);
  });

  return tasks;
}
