/**
 * Group building logic for group/issue spec
 */
import {
  coerceStringArray,
  collectAliasKeys,
  registerKeys,
  slugifyValue,
  toOptionalString,
} from "./helpers";

export type GroupArtifact = {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  type: string;
};

export type GroupSpec = {
  id: string;
  slug: string;
  artifactId: string;
  name: string;
  description?: string;
  status?: string;
  priority?: string;
  owner?: string;
  metadata: Record<string, unknown>;
  tasks: TaskSpec[];
};

export type TaskSpec = {
  id: string;
  slug: string;
  artifactId: string;
  name: string;
  description?: string;
  status?: string;
  assignee?: string;
  priority?: string;
  dependsOn?: string[];
  groupId?: string;
  groupName?: string;
  completed?: boolean;
  metadata: Record<string, unknown>;
};

export function buildGroups(
  groupArtifacts: GroupArtifact[],
  groupMatchMap: Map<string, GroupSpec>,
): GroupSpec[] {
  const groups: GroupSpec[] = [];

  groupArtifacts.forEach((artifact) => {
    const metadata: Record<string, unknown> = {
      ...(artifact.metadata ?? {}),
    };

    const slug = slugifyValue(
      toOptionalString(metadata.slug) ?? artifact.name,
      `group-${artifact.id}`,
    );
    const id = toOptionalString(metadata.id) ?? slug;

    metadata.id = id;
    metadata.slug = slug;
    metadata.artifactId = artifact.id;

    const status = toOptionalString(metadata.status);
    const priority = toOptionalString(metadata.priority);
    const owner = toOptionalString(metadata.owner ?? metadata.assignee);
    const referencedTasks = Array.isArray(metadata.tasks)
      ? (metadata.tasks as unknown[])
          .map((task) => (typeof task === "string" ? task.trim() : ""))
          .filter((task): task is string => task.length > 0)
      : coerceStringArray(metadata.tasks);

    const group: GroupSpec = {
      id,
      slug,
      artifactId: artifact.id,
      name: artifact.name,
      ...(artifact.description ? { description: artifact.description } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(owner ? { owner } : {}),
      metadata,
      tasks: [],
    };

    groups.push(group);

    registerKeys(
      groupMatchMap,
      [id, slug, artifact.name, metadata.slug as string, metadata.id as string],
      group,
    );
    registerKeys(groupMatchMap, collectAliasKeys(metadata.aliases), group);
    registerKeys(groupMatchMap, referencedTasks, group);
  });

  return groups;
}
