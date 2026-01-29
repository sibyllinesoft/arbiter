import { coerceOptionalTrimmedString, coerceStringArray } from "./shared";
/**
 * Workflow artifact payload builders (capability, group, task)
 */
import type { ManualArtifactPayload } from "./types";

/**
 * Build capability artifact payload with owner and gherkin spec.
 */
export function buildCapabilityPayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const owner = coerceOptionalTrimmedString(values.owner);
  const gherkinSpec = coerceOptionalTrimmedString(values.gherkin);
  return {
    name,
    description,
    artifactType: "capability",
    metadata: {
      description,
      ...(owner ? { owner } : {}),
      ...(gherkinSpec ? { gherkinSpec } : {}),
      classification: { detectedType: "capability", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build group artifact payload with tasks and priority.
 */
export function buildGroupPayload(
  values: Record<string, any>,
  slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const tasks = coerceStringArray(values.tasks);
  const status = coerceOptionalTrimmedString(values.status);
  const priority = coerceOptionalTrimmedString(values.priority);
  const owner = coerceOptionalTrimmedString(values.owner);
  return {
    name,
    description,
    artifactType: "group",
    metadata: {
      description,
      id: slug,
      slug,
      tasks: tasks.length > 0 ? tasks : undefined,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(owner ? { owner } : {}),
      classification: { detectedType: "group", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build system artifact payload (a group with system subtype for C4 context).
 */
export function buildSystemPayload(
  values: Record<string, any>,
  slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const owner = coerceOptionalTrimmedString(values.owner);
  return {
    name,
    description,
    artifactType: "system",
    metadata: {
      description,
      id: slug,
      slug,
      subtype: "system",
      ...(owner ? { owner } : {}),
      classification: { detectedType: "system", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Determine if a task is completed based on various indicators.
 */
function isTaskCompleted(values: Record<string, any>): boolean | undefined {
  if (values.completed === true || values.done === true) return true;

  if (typeof values.completed === "string") {
    const normalized = values.completed.trim().toLowerCase();
    if (["true", "yes", "y", "1", "done", "completed"].includes(normalized)) return true;
  }

  if (typeof values.status === "string") {
    const normalizedStatus = values.status.trim().toLowerCase();
    if (["done", "completed", "complete", "closed", "resolved"].includes(normalizedStatus))
      return true;
  }

  return undefined;
}

/**
 * Build task artifact payload with status, assignee, and dependencies.
 */
export function buildTaskPayload(
  values: Record<string, any>,
  slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const status = coerceOptionalTrimmedString(values.status);
  const assignee = coerceOptionalTrimmedString(values.assignee);
  const owner = coerceOptionalTrimmedString(values.owner);
  const priority = coerceOptionalTrimmedString(values.priority);
  const groupId = coerceOptionalTrimmedString(values.groupId);
  const groupName = coerceOptionalTrimmedString(values.groupName);
  const groupRef = coerceOptionalTrimmedString(values.group);

  const dependencyValues = [
    values.dependsOn,
    values.depends_on,
    values.dependencies,
    values.blockedBy,
    values.blocked_by,
  ];
  const dependsOn = Array.from(
    new Set(dependencyValues.flatMap((e) => coerceStringArray(e)).filter((i) => i.length > 0)),
  );

  const completedFlag = isTaskCompleted(values);

  return {
    name,
    description,
    artifactType: "task",
    metadata: {
      description,
      id: slug,
      slug,
      status,
      ...(assignee ? { assignee } : {}),
      ...(owner ? { owner } : {}),
      ...(priority ? { priority } : {}),
      ...(dependsOn.length ? { dependsOn } : {}),
      ...(groupId ? { groupId } : {}),
      ...(groupName ? { groupName } : {}),
      ...(groupRef ? { group: groupRef } : {}),
      ...(completedFlag !== undefined ? { completed: completedFlag } : {}),
      classification: { detectedType: "task", reason: "manual-entry", source: "user" },
    },
  };
}
