/**
 * Helper functions for extracting task data from raw records.
 * These utilities handle the various formats that task data can come in.
 */
import type { UnknownRecord } from "./types";
import {
  getBooleanFlag,
  getNestedRecord,
  getString,
  normalizeString,
  slugify,
  toArray,
} from "./utils";

/** Extract group ID from task record */
export function extractGroupId(taskRecord: UnknownRecord, metadata: UnknownRecord): string | null {
  return (
    getString(taskRecord, "groupId") ??
    getString(taskRecord, "group_id") ??
    getString(metadata, "groupId") ??
    getString(metadata, "group_id") ??
    null
  );
}

/** Extract group name from task record */
export function extractGroupName(
  taskRecord: UnknownRecord,
  metadata: UnknownRecord,
): string | null {
  return (
    getString(taskRecord, "groupName") ??
    getString(metadata, "groupName") ??
    getString(metadata, "group") ??
    null
  );
}

/** Extract raw task ID from task record */
export function extractRawTaskId(
  taskRecord: UnknownRecord,
  key: string | undefined,
  inlineName: string | null,
  fallbackBase: string,
): string {
  return (
    getString(taskRecord, "id") ??
    getString(taskRecord, "slug") ??
    normalizeString(key) ??
    inlineName ??
    fallbackBase
  );
}

/** Extract description from task record */
export function extractDescription(
  taskRecord: UnknownRecord,
  metadata: UnknownRecord,
): string | undefined {
  return (
    getString(taskRecord, "description") ??
    getString(taskRecord, "summary") ??
    getString(metadata, "description") ??
    getString(metadata, "summary") ??
    undefined
  );
}

/** Extract status from task record */
export function extractStatus(
  taskRecord: UnknownRecord,
  metadata: UnknownRecord,
): { status: string | undefined; statusTokens: string[] } {
  const statusCandidates = [
    getString(taskRecord, "status"),
    getString(taskRecord, "state"),
    getString(metadata, "status"),
    getString(metadata, "state"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return {
    status: statusCandidates[0] ?? undefined,
    statusTokens: statusCandidates.map((token) => token.toLowerCase()),
  };
}

/** Extract assignee from task record */
export function extractAssignee(
  taskRecord: UnknownRecord,
  metadata: UnknownRecord,
): string | undefined {
  return (
    getString(taskRecord, "assignee") ??
    getString(taskRecord, "owner") ??
    getString(metadata, "assignee") ??
    getString(metadata, "owner") ??
    undefined
  );
}

/** Extract artifact ID from task record */
export function extractArtifactId(
  taskRecord: UnknownRecord,
  metadata: UnknownRecord,
): string | null {
  return (
    getString(taskRecord, "artifactId") ??
    getString(taskRecord, "artifact_id") ??
    getString(taskRecord, "entityId") ??
    getString(taskRecord, "entity_id") ??
    getString(metadata, "artifactId") ??
    getString(metadata, "artifact_id") ??
    getString(metadata, "entityId") ??
    getString(metadata, "entity_id") ??
    null
  );
}

/** Check if task is completed */
export function isTaskCompleted(
  taskRecord: UnknownRecord,
  metadata: UnknownRecord,
  statusTokens: string[],
): boolean {
  return (
    getBooleanFlag(taskRecord["completed"]) ||
    getBooleanFlag(taskRecord["done"]) ||
    getBooleanFlag(taskRecord["isCompleted"]) ||
    getBooleanFlag(metadata["completed"]) ||
    getBooleanFlag(metadata["done"]) ||
    getBooleanFlag(metadata["isCompleted"]) ||
    statusTokens.includes("completed") ||
    statusTokens.includes("done")
  );
}

/** Extract dependencies from task record */
export function extractDependencies(taskRecord: UnknownRecord, metadata: UnknownRecord): string[] {
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

  return dependencySources
    .flatMap((entry) => toArray(entry))
    .filter((dep, depIndex, self) => self.indexOf(dep) === depIndex);
}

/** Extract aliases from task record */
export function extractAliases(taskRecord: UnknownRecord, metadata: UnknownRecord): string[] {
  const aliasCandidates = taskRecord["aliases"] ?? metadata["aliases"];
  if (Array.isArray(aliasCandidates)) {
    return aliasCandidates
      .map((item) => normalizeString(item))
      .filter((item): item is string => Boolean(item));
  }
  if (typeof aliasCandidates === "string") {
    return aliasCandidates
      .split(",")
      .map((item) => normalizeString(item))
      .filter((item): item is string => Boolean(item));
  }
  return [];
}

/** Build match keys for a task or group */
export function buildMatchKeys(identifiers: (string | null | undefined)[]): string[] {
  const keys = Array.from(
    new Set(
      identifiers
        .map((item) => (item ? slugify(String(item)) : null))
        .filter((item): item is string => Boolean(item)),
    ),
  );
  return keys;
}

/** Extract group ID candidates from task record for global task processing */
export function extractGroupCandidates(
  taskRecord: UnknownRecord,
  metadata: UnknownRecord,
): string[] {
  return [
    getString(taskRecord, "groupId"),
    getString(taskRecord, "group_id"),
    getString(taskRecord, "group"),
    getString(metadata, "groupId"),
    getString(metadata, "group"),
  ].filter((candidate): candidate is string => Boolean(candidate));
}
