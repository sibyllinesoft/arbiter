import {
  buildMatchKeys,
  extractAliases,
  extractArtifactId,
  extractAssignee,
  extractDependencies,
  extractDescription,
  extractGroupCandidates,
  extractGroupId,
  extractGroupName,
  extractRawTaskId,
  extractStatus,
  isTaskCompleted,
} from "./task-extractors";
/**
 * Task normalization functions for the TasksDiagram component.
 * Transforms raw task and group data into normalized structures for rendering.
 */
import type {
  NormalizeTaskArgs,
  NormalizedTask,
  NormalizedTaskGroup,
  ResolvedSpec,
  UnknownRecord,
} from "./types";
import {
  deriveStatusClass,
  ensureArray,
  getNestedRecord,
  getString,
  normalizeString,
  slugify,
  toRecord,
} from "./utils";

/** Generate node ID and slug for a task */
function generateTaskIdentifiers(
  rawId: string | null,
  name: string,
  fallbackBase: string,
  nodePrefix: string,
  index: number,
): { slugValue: string; nodeIdBase: string; nodeId: string } {
  const slugSeed = rawId ?? name ?? fallbackBase;
  const slugValue = slugify(slugSeed);
  const sanitizedPrefix = slugify(nodePrefix) || "task";
  const nodeIdBase = slugValue || `${sanitizedPrefix}-${index + 1}`;
  const nodeId = `task_${nodeIdBase}`;
  return { slugValue, nodeIdBase, nodeId };
}

/** Apply optional fields to normalized task */
function applyOptionalFields(
  task: NormalizedTask,
  fields: {
    status?: string;
    assignee?: string;
    priority?: string;
    description?: string;
    artifactId?: string;
  },
): void {
  if (fields.status) task.status = fields.status;
  if (fields.assignee) task.assignee = fields.assignee;
  if (fields.priority) task.priority = fields.priority;
  if (fields.description) task.description = fields.description;
  if (fields.artifactId) task.artifactId = fields.artifactId;
}

/** Apply group context to normalized task */
function applyGroupContext(
  task: NormalizedTask,
  groupContext: NormalizeTaskArgs["groupContext"],
  explicitGroupId: string | null,
  explicitGroupName: string | null,
): void {
  if (groupContext) {
    task.groupId = groupContext.id ?? groupContext.slug;
    task.groupName = groupContext.name;
  }
  if (!task.groupId && explicitGroupId) {
    task.groupId = explicitGroupId;
  }
  if (!task.groupName && explicitGroupName) {
    task.groupName = explicitGroupName;
  }
}

/** Normalize a raw task value into a structured NormalizedTask object */
export function normalizeTask({
  value,
  key,
  index,
  nodePrefix,
  groupContext,
}: NormalizeTaskArgs): NormalizedTask | null {
  const taskRecord = typeof value === "string" ? {} : toRecord(value);
  const inlineName = normalizeString(typeof value === "string" ? value : taskRecord["name"]);
  const metadata = getNestedRecord(taskRecord, "metadata");

  const fallbackBase = groupContext
    ? `${groupContext.slug}-task-${index + 1}`
    : `${nodePrefix || "task"}-${index + 1}`;

  const rawId = extractRawTaskId(taskRecord, key, inlineName, fallbackBase);
  const name = getString(taskRecord, "name") ?? inlineName ?? rawId ?? fallbackBase;
  const { status, statusTokens } = extractStatus(taskRecord, metadata);
  const completedFlag = isTaskCompleted(taskRecord, metadata, statusTokens);
  const dependsOn = extractDependencies(taskRecord, metadata);
  const aliasValues = extractAliases(taskRecord, metadata);

  const { slugValue, nodeIdBase, nodeId } = generateTaskIdentifiers(
    rawId,
    name,
    fallbackBase,
    nodePrefix,
    index,
  );

  const matchKeys = buildMatchKeys([rawId, name, key, slugValue, ...aliasValues]);
  if (!matchKeys.includes(nodeIdBase)) {
    matchKeys.push(nodeIdBase);
  }

  const normalizedTask: NormalizedTask = {
    rawId: rawId ?? fallbackBase,
    name: name ?? fallbackBase,
    slug: slugValue || nodeIdBase,
    dependsOn,
    nodeId,
    statusClass: deriveStatusClass(status ?? (completedFlag ? "completed" : undefined)),
    completed: completedFlag,
    matchKeys,
  };

  applyOptionalFields(normalizedTask, {
    status,
    assignee: extractAssignee(taskRecord, metadata),
    priority: getString(taskRecord, "priority") ?? getString(metadata, "priority") ?? undefined,
    description: extractDescription(taskRecord, metadata),
    artifactId: extractArtifactId(taskRecord, metadata),
  });

  applyGroupContext(
    normalizedTask,
    groupContext,
    extractGroupId(taskRecord, metadata),
    extractGroupName(taskRecord, metadata),
  );

  return normalizedTask;
}

/** Create the unscoped group for tasks without a group assignment */
function createUnscopedGroup(): NormalizedTaskGroup {
  return {
    id: "unscoped",
    rawId: "unscoped",
    artifactId: null,
    name: "Unscoped",
    description: "Tasks that are not assigned to an group yet.",
    tasks: [],
    type: "unscoped",
    matchKeys: ["unscoped"],
  };
}

/** Add a task to a group with deduplication */
function addTaskToGroup(
  group: NormalizedTaskGroup,
  task: NormalizedTask,
  seenMap: Map<NormalizedTaskGroup, Set<string>>,
): void {
  const dedupeKey = task.slug || slugify(task.rawId) || `${group.id}-${task.nodeId}`;
  let seen = seenMap.get(group);
  if (!seen) {
    seen = new Set<string>();
    seenMap.set(group, seen);
  }

  if (dedupeKey && seen.has(dedupeKey)) return;
  if (dedupeKey) seen.add(dedupeKey);

  group.tasks.push(task);
}

/** Extract group raw ID from multiple sources */
function extractGroupRawId(
  groupRecord: UnknownRecord,
  metadata: UnknownRecord,
  key: string | undefined,
  fallback: string,
): string {
  return (
    getString(groupRecord, "id") ??
    getString(groupRecord, "slug") ??
    getString(metadata, "id") ??
    getString(metadata, "slug") ??
    normalizeString(key) ??
    fallback
  );
}

/** Extract artifact ID from multiple sources */
function extractGroupArtifactId(
  groupRecord: UnknownRecord,
  metadata: UnknownRecord,
): string | null {
  return (
    getString(groupRecord, "artifactId") ??
    getString(groupRecord, "artifact_id") ??
    getString(metadata, "artifactId") ??
    getString(metadata, "artifact_id") ??
    getString(metadata, "entityId") ??
    getString(metadata, "entity_id") ??
    null
  );
}

/** Extract and normalize aliases from group record */
function extractGroupAliases(groupRecord: UnknownRecord): string[] {
  const aliasRaw = groupRecord["aliases"];
  if (!Array.isArray(aliasRaw)) return [];
  return aliasRaw
    .map((item) => normalizeString(item))
    .filter((item): item is string => Boolean(item));
}

/** Process a group entry and create a NormalizedTaskGroup */
function processGroupEntry(
  key: string | undefined,
  value: unknown,
  index: number,
  groupMatchMap: Map<string, NormalizedTaskGroup>,
  groupTaskSeen: Map<NormalizedTaskGroup, Set<string>>,
): NormalizedTaskGroup | null {
  if (!value && typeof value !== "string") return null;

  const groupRecord =
    typeof value === "string" ? ({ name: value } satisfies UnknownRecord) : toRecord(value);
  const metadata = getNestedRecord(groupRecord, "metadata");
  const fallbackId = `group-${index + 1}`;

  const rawGroupId = extractGroupRawId(groupRecord, metadata, key, fallbackId);
  const groupName = getString(groupRecord, "name") ?? rawGroupId ?? `Group ${index + 1}`;
  const description =
    getString(groupRecord, "description") ?? getString(groupRecord, "summary") ?? undefined;
  const aliasValues = extractGroupAliases(groupRecord);
  const artifactId = extractGroupArtifactId(groupRecord, metadata);

  const metadataSlug = getString(metadata, "slug") ?? getString(metadata, "id");
  const slugBase = rawGroupId ?? metadataSlug ?? groupName ?? `${key || "group"}-${index + 1}`;
  const groupSlug = slugify(slugBase) || fallbackId;

  const matchKeys = buildMatchKeys([
    rawGroupId,
    groupName,
    normalizeString(key),
    getString(groupRecord, "slug"),
    getString(metadata, "slug"),
    getString(metadata, "id"),
    groupSlug,
    ...aliasValues,
  ]);
  if (!matchKeys.includes(groupSlug)) matchKeys.push(groupSlug);

  const groupNode: NormalizedTaskGroup = {
    id: groupSlug,
    rawId: rawGroupId ?? groupSlug,
    artifactId,
    name: groupName,
    tasks: [],
    type: "group",
    matchKeys,
    ...(description ? { description } : {}),
  };

  matchKeys.forEach((matchKey) => {
    if (!groupMatchMap.has(matchKey)) groupMatchMap.set(matchKey, groupNode);
  });

  // Process tasks within this group
  const taskSource = groupRecord["tasks"] ?? [];
  const taskEntries = ensureArray(taskSource);

  taskEntries.forEach(({ key: taskKey, value: taskValue, index: taskIndex }) => {
    const normalizedTask = normalizeTask({
      value: taskValue,
      key: taskKey,
      index: taskIndex,
      nodePrefix: `${groupNode.id}-task`,
      groupContext: {
        id: groupNode.rawId ?? groupNode.id,
        slug: groupNode.id,
        name: groupNode.name,
      },
    });

    if (normalizedTask) {
      addTaskToGroup(groupNode, normalizedTask, groupTaskSeen);
    }
  });

  return groupNode;
}

/** Find target group for a global task */
function findTargetGroup(
  groupCandidates: string[],
  groupMatchMap: Map<string, NormalizedTaskGroup>,
): NormalizedTaskGroup | null {
  for (const candidate of groupCandidates) {
    const lookup = slugify(candidate);
    if (lookup && groupMatchMap.has(lookup)) {
      const group = groupMatchMap.get(lookup);
      if (group) return group;
    }
  }
  return null;
}

/** Build normalized task groups from resolved spec data */
export function buildTaskGroups(resolved: ResolvedSpec | null | undefined): NormalizedTaskGroup[] {
  const unscopedGroup = createUnscopedGroup();

  if (!resolved) return [unscopedGroup];

  const resolvedRecord = toRecord(resolved);
  const specRecord = getNestedRecord(resolvedRecord, "spec");

  const groupSource = specRecord["groups"] ?? resolvedRecord["groups"] ?? [];
  const groupEntries = ensureArray(groupSource);

  const groupNodes: NormalizedTaskGroup[] = [];
  const groupMatchMap = new Map<string, NormalizedTaskGroup>();
  const groupTaskSeen = new Map<NormalizedTaskGroup, Set<string>>();

  // Process group entries
  groupEntries.forEach(({ key, value, index }) => {
    const groupNode = processGroupEntry(key, value, index, groupMatchMap, groupTaskSeen);
    if (groupNode) groupNodes.push(groupNode);
  });

  // Process global tasks
  const globalTaskSource = specRecord["tasks"] ?? resolvedRecord["tasks"] ?? [];
  const globalTaskEntries = ensureArray(globalTaskSource);

  globalTaskEntries.forEach(({ key, value, index }) => {
    const taskRecord = typeof value === "string" ? {} : toRecord(value);
    const metadata = getNestedRecord(taskRecord, "metadata");
    const groupCandidates = extractGroupCandidates(taskRecord, metadata);
    const targetGroup = findTargetGroup(groupCandidates, groupMatchMap);

    const normalizedTask = normalizeTask({
      value,
      key,
      index,
      nodePrefix: targetGroup ? `${targetGroup.id}-task` : "unscoped-task",
      ...(targetGroup
        ? {
            groupContext: {
              id: targetGroup.rawId ?? targetGroup.id,
              slug: targetGroup.id,
              name: targetGroup.name,
            },
          }
        : {}),
    });

    if (!normalizedTask) return;

    if (targetGroup) {
      addTaskToGroup(targetGroup, normalizedTask, groupTaskSeen);
    } else {
      addTaskToGroup(unscopedGroup, normalizedTask, groupTaskSeen);
    }
  });

  const allGroups = [unscopedGroup, ...groupNodes];

  allGroups.forEach((group) => {
    group.tasks.sort((a, b) => {
      const nameA = a.name ?? a.rawId;
      const nameB = b.name ?? b.rawId;
      return nameA.localeCompare(nameB);
    });
  });

  return allGroups;
}
