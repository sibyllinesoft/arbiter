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
  getBooleanFlag,
  getNestedRecord,
  getString,
  normalizeString,
  slugify,
  toArray,
  toRecord,
} from "./utils";

export const normalizeTask = ({
  value,
  key,
  index,
  nodePrefix,
  epicContext,
}: NormalizeTaskArgs): NormalizedTask | null => {
  const taskRecord = typeof value === "string" ? {} : toRecord(value);
  const inlineName = normalizeString(typeof value === "string" ? value : taskRecord["name"]);
  const metadata = getNestedRecord(taskRecord, "metadata");

  const explicitEpicId =
    getString(taskRecord, "epicId") ??
    getString(taskRecord, "epic_id") ??
    getString(metadata, "epicId") ??
    getString(metadata, "epic_id") ??
    null;

  const explicitEpicName =
    getString(taskRecord, "epicName") ??
    getString(metadata, "epicName") ??
    getString(metadata, "epic") ??
    null;

  const fallbackBase = epicContext
    ? `${epicContext.slug}-task-${index + 1}`
    : `${nodePrefix || "task"}-${index + 1}`;

  const rawId =
    getString(taskRecord, "id") ??
    getString(taskRecord, "slug") ??
    normalizeString(key) ??
    inlineName ??
    fallbackBase;

  const name = getString(taskRecord, "name") ?? inlineName ?? rawId ?? fallbackBase;

  const description =
    getString(taskRecord, "description") ??
    getString(taskRecord, "summary") ??
    getString(metadata, "description") ??
    getString(metadata, "summary") ??
    undefined;

  const statusCandidates = [
    getString(taskRecord, "status"),
    getString(taskRecord, "state"),
    getString(metadata, "status"),
    getString(metadata, "state"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const statusTokens = statusCandidates.map((token) => token.toLowerCase());
  const status = statusCandidates[0] ?? undefined;

  const assignee =
    getString(taskRecord, "assignee") ??
    getString(taskRecord, "owner") ??
    getString(metadata, "assignee") ??
    getString(metadata, "owner") ??
    undefined;

  const priority =
    getString(taskRecord, "priority") ?? getString(metadata, "priority") ?? undefined;

  const completedFlag =
    getBooleanFlag(taskRecord["completed"]) ||
    getBooleanFlag(taskRecord["done"]) ||
    getBooleanFlag(taskRecord["isCompleted"]) ||
    getBooleanFlag(metadata["completed"]) ||
    getBooleanFlag(metadata["done"]) ||
    getBooleanFlag(metadata["isCompleted"]) ||
    statusTokens.includes("completed") ||
    statusTokens.includes("done");

  const dependencySources = [
    taskRecord["dependsOn"],
    taskRecord["depends_on"],
    taskRecord["dependencies"],
    taskRecord["blockedBy"],
    taskRecord["blocked_by"],
    metadata["dependsOn"],
    metadata["depends_on"],
    metadata["dependencies"],
  ];

  const dependsOn = dependencySources
    .flatMap((entry) => toArray(entry))
    .filter((dep, depIndex, self) => self.indexOf(dep) === depIndex);

  const aliasCandidates = taskRecord["aliases"] ?? metadata["aliases"];
  const aliasValues = Array.isArray(aliasCandidates)
    ? aliasCandidates
        .map((item) => normalizeString(item))
        .filter((item): item is string => Boolean(item))
    : typeof aliasCandidates === "string"
      ? aliasCandidates
          .split(",")
          .map((item) => normalizeString(item))
          .filter((item): item is string => Boolean(item))
      : [];

  const artifactId =
    getString(taskRecord, "artifactId") ??
    getString(taskRecord, "artifact_id") ??
    getString(taskRecord, "entityId") ??
    getString(taskRecord, "entity_id") ??
    getString(metadata, "artifactId") ??
    getString(metadata, "artifact_id") ??
    getString(metadata, "entityId") ??
    getString(metadata, "entity_id") ??
    null;

  const slugSeed = rawId ?? name ?? fallbackBase;
  const slugValue = slugify(slugSeed);
  const sanitizedPrefix = slugify(nodePrefix) || "task";
  const nodeIdBase = slugValue || `${sanitizedPrefix}-${index + 1}`;
  const nodeId = `task_${nodeIdBase}`;

  const matchKeys = Array.from(
    new Set(
      [rawId, name, key, slugValue, ...aliasValues]
        .map((item) => (item ? slugify(String(item)) : null))
        .filter((item): item is string => Boolean(item)),
    ),
  );

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

  if (status) {
    normalizedTask.status = status;
  }

  if (assignee) {
    normalizedTask.assignee = assignee;
  }

  if (priority) {
    normalizedTask.priority = priority;
  }

  if (description) {
    normalizedTask.description = description;
  }

  if (artifactId) {
    normalizedTask.artifactId = artifactId;
  }

  if (epicContext) {
    const effectiveEpicId = epicContext.id ?? epicContext.slug;
    normalizedTask.epicId = effectiveEpicId;
    normalizedTask.epicName = epicContext.name;
  }

  if (!normalizedTask.epicId && explicitEpicId) {
    normalizedTask.epicId = explicitEpicId;
  }

  if (!normalizedTask.epicName && explicitEpicName) {
    normalizedTask.epicName = explicitEpicName;
  }

  return normalizedTask;
};

export const buildTaskGroups = (
  resolved: ResolvedSpec | null | undefined,
): NormalizedTaskGroup[] => {
  const unscopedGroup: NormalizedTaskGroup = {
    id: "unscoped",
    rawId: "unscoped",
    artifactId: null,
    name: "Unscoped",
    description: "Tasks that are not assigned to an epic yet.",
    tasks: [],
    type: "unscoped",
    matchKeys: ["unscoped"],
  };

  if (!resolved) {
    return [unscopedGroup];
  }

  const resolvedRecord = toRecord(resolved);
  const specRecord = getNestedRecord(resolvedRecord, "spec");

  const epicSource = specRecord["epics"] ?? resolvedRecord["epics"] ?? [];
  const epicEntries = ensureArray(epicSource);

  const epicGroups: NormalizedTaskGroup[] = [];
  const epicMatchMap = new Map<string, NormalizedTaskGroup>();
  const groupTaskSeen = new Map<NormalizedTaskGroup, Set<string>>();

  const addTaskToGroup = (group: NormalizedTaskGroup, task: NormalizedTask) => {
    const dedupeKey = task.slug || slugify(task.rawId) || `${group.id}-${task.nodeId}`;
    let seen = groupTaskSeen.get(group);
    if (!seen) {
      seen = new Set<string>();
      groupTaskSeen.set(group, seen);
    }

    if (dedupeKey && seen.has(dedupeKey)) {
      return;
    }

    if (dedupeKey) {
      seen.add(dedupeKey);
    }

    group.tasks.push(task);
  };

  epicEntries.forEach(({ key, value, index }) => {
    if (!value && typeof value !== "string") {
      return;
    }

    const epicRecord =
      typeof value === "string" ? ({ name: value } satisfies UnknownRecord) : toRecord(value);
    const metadata = getNestedRecord(epicRecord, "metadata");
    const rawEpicId =
      getString(epicRecord, "id") ??
      getString(epicRecord, "slug") ??
      getString(metadata, "id") ??
      getString(metadata, "slug") ??
      normalizeString(key) ??
      `epic-${index + 1}`;

    const epicName = getString(epicRecord, "name") ?? rawEpicId ?? `Epic ${index + 1}`;

    const description =
      getString(epicRecord, "description") ?? getString(epicRecord, "summary") ?? undefined;

    const aliasRaw = epicRecord["aliases"];
    const aliasValues = Array.isArray(aliasRaw)
      ? aliasRaw
          .map((item) => normalizeString(item))
          .filter((item): item is string => Boolean(item))
      : [];

    const metadataSlug = getString(metadata, "slug") ?? getString(metadata, "id");
    const artifactId =
      getString(epicRecord, "artifactId") ??
      getString(epicRecord, "artifact_id") ??
      getString(metadata, "artifactId") ??
      getString(metadata, "artifact_id") ??
      getString(metadata, "entityId") ??
      getString(metadata, "entity_id") ??
      null;

    const slugBase = rawEpicId ?? metadataSlug ?? epicName ?? `${key || "epic"}-${index + 1}`;
    const epicSlug = slugify(slugBase) || `epic-${index + 1}`;

    const matchKeys = Array.from(
      new Set(
        [
          rawEpicId,
          epicName,
          normalizeString(key),
          getString(epicRecord, "slug"),
          getString(metadata, "slug"),
          getString(metadata, "id"),
          epicSlug,
          ...aliasValues,
        ]
          .map((item) => (item ? slugify(String(item)) : null))
          .filter((item): item is string => Boolean(item)),
      ),
    );

    if (!matchKeys.includes(epicSlug)) {
      matchKeys.push(epicSlug);
    }

    const epicGroup: NormalizedTaskGroup = {
      id: epicSlug,
      rawId: rawEpicId ?? epicSlug,
      artifactId,
      name: epicName,
      tasks: [],
      type: "epic",
      matchKeys,
      ...(description ? { description } : {}),
    };

    epicGroups.push(epicGroup);
    matchKeys.forEach((matchKey) => {
      if (!epicMatchMap.has(matchKey)) {
        epicMatchMap.set(matchKey, epicGroup);
      }
    });

    const taskSource = epicRecord["tasks"] ?? [];
    const taskEntries = ensureArray(taskSource);

    taskEntries.forEach(({ key: taskKey, value: taskValue, index: taskIndex }) => {
      const normalizedTask = normalizeTask({
        value: taskValue,
        key: taskKey,
        index: taskIndex,
        nodePrefix: `${epicGroup.id}-task`,
        epicContext: {
          id: epicGroup.rawId ?? epicGroup.id,
          slug: epicGroup.id,
          name: epicGroup.name,
        },
      });

      if (normalizedTask) {
        addTaskToGroup(epicGroup, normalizedTask);
      }
    });
  });

  const globalTaskSource = specRecord["tasks"] ?? resolvedRecord["tasks"] ?? [];
  const globalTaskEntries = ensureArray(globalTaskSource);

  globalTaskEntries.forEach(({ key, value, index }) => {
    const taskRecord = typeof value === "string" ? {} : toRecord(value);
    const metadata = getNestedRecord(taskRecord, "metadata");

    const epicCandidates = [
      getString(taskRecord, "epicId"),
      getString(taskRecord, "epic_id"),
      getString(taskRecord, "epic"),
      getString(metadata, "epicId"),
      getString(metadata, "epic"),
    ].filter((candidate): candidate is string => Boolean(candidate));

    let targetEpic: NormalizedTaskGroup | null = null;

    for (const candidate of epicCandidates) {
      const lookup = slugify(candidate);
      if (lookup && epicMatchMap.has(lookup)) {
        targetEpic = epicMatchMap.get(lookup) ?? null;
        if (targetEpic) {
          break;
        }
      }
    }

    const normalizedTask = normalizeTask({
      value,
      key,
      index,
      nodePrefix: targetEpic ? `${targetEpic.id}-task` : "unscoped-task",
      ...(targetEpic
        ? {
            epicContext: {
              id: targetEpic.rawId ?? targetEpic.id,
              slug: targetEpic.id,
              name: targetEpic.name,
            },
          }
        : {}),
    });

    if (!normalizedTask) {
      return;
    }

    if (targetEpic) {
      addTaskToGroup(targetEpic, normalizedTask);
    } else {
      addTaskToGroup(unscopedGroup, normalizedTask);
    }
  });

  const allGroups = [unscopedGroup, ...epicGroups];

  allGroups.forEach((group) => {
    group.tasks.sort((a, b) => {
      const nameA = a.name ?? a.rawId;
      const nameB = b.name ?? b.rawId;
      return nameA.localeCompare(nameB);
    });
  });

  return allGroups;
};
