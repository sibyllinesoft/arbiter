/**
 * @module EventsReport/utils/targetInfoHandlers
 * Event type specific handlers for target info extraction.
 */

import type { Event } from "@/types/api";
import { humanizeKey } from "./formatting";
import {
  type EventTargetInfo,
  type GetEventTargetContext,
  buildDescription,
  coerceToString,
  createArrayExtractor,
  createStringExtractor,
  createTargetInfo,
  createTimelineTarget,
  formatId,
} from "./targetInfoHelpers";

/**
 * Handler context passed to each event type handler.
 */
export type HandlerContext = {
  event: Event;
  data: Record<string, unknown>;
  takeString: (...keys: string[]) => string | undefined;
  getArray: (key: string) => unknown[];
  lookupEvent?: ((eventId: string) => Event | undefined) | undefined;
  seen: Set<string>;
  getEventTargetInfo: (event: Event, context: GetEventTargetContext) => EventTargetInfo;
};

/**
 * Event type handler function signature.
 */
export type EventTypeHandler = (ctx: HandlerContext) => EventTargetInfo | null;

/**
 * Resolves target info from event IDs by looking up referenced events.
 */
export const resolveFromEventIds = (
  ids: unknown[],
  ctx: HandlerContext,
): EventTargetInfo | null => {
  if (!ctx.lookupEvent) return null;
  for (const value of ids) {
    const id = coerceToString(value);
    if (!id) continue;
    const referenced = ctx.lookupEvent(id);
    if (referenced) {
      return ctx.getEventTargetInfo(referenced, { lookupEvent: ctx.lookupEvent, seen: ctx.seen });
    }
  }
  return null;
};

/**
 * Resolves target info from an event-like object.
 */
export const resolveFromEventLike = (
  value: unknown,
  fallbackId: string,
  ctx: HandlerContext,
): EventTargetInfo | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Event> & Record<string, unknown>;
  const type = raw.event_type;
  if (!type || typeof type !== "string") return null;
  const normalized: Event = {
    id: String(raw.id ?? fallbackId),
    project_id: String(raw.project_id ?? ctx.event.project_id),
    event_type: type as Event["event_type"],
    data: raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : {},
    is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
    reverted_at: typeof raw.reverted_at === "string" ? raw.reverted_at : null,
    created_at: typeof raw.created_at === "string" ? raw.created_at : ctx.event.created_at,
  };
  const nextContext = ctx.lookupEvent
    ? { lookupEvent: ctx.lookupEvent, seen: ctx.seen }
    : { seen: ctx.seen };
  return ctx.getEventTargetInfo(normalized, nextContext);
};

/**
 * Resolves target info from an array of event-like objects.
 */
export const resolveFromEventArray = (
  values: unknown[],
  prefix: string,
  ctx: HandlerContext,
): EventTargetInfo | null => {
  for (let index = 0; index < values.length; index += 1) {
    const entry = resolveFromEventLike(values[index], `${ctx.event.id}-${prefix}-${index}`, ctx);
    if (entry) {
      return entry;
    }
  }
  return null;
};

// Fragment event handlers
export const handleFragmentEvents: EventTypeHandler = (ctx) => {
  const { takeString } = ctx;
  const fragmentId = takeString("fragment_id", "fragmentId", "id");
  const fragmentPath = takeString("fragment_path", "path");
  const revisionId = takeString("revision_id", "revisionId");
  const revisionNumber = takeString("revision_number", "revisionNumber");

  const label =
    fragmentPath ?? (fragmentId ? `Fragment ${formatId(fragmentId) ?? fragmentId}` : "Fragment");

  const descriptionParts: (string | undefined)[] = [];
  if (fragmentId) {
    descriptionParts.push(`ID ${formatId(fragmentId) ?? fragmentId}`);
  }
  if (revisionNumber) {
    descriptionParts.push(`Rev ${revisionNumber}`);
  } else if (revisionId) {
    descriptionParts.push(`Revision ${formatId(revisionId) ?? revisionId}`);
  }

  return createTargetInfo(
    `fragment:${fragmentId ?? fragmentPath ?? ctx.event.event_type}`,
    label,
    buildDescription(descriptionParts),
  );
};

// Validation event handlers
export const handleValidationEvents: EventTypeHandler = (ctx) => {
  const { takeString } = ctx;
  const validationId = takeString("validation_id", "validationId");
  const specHash = takeString("spec_hash", "specHash");
  const fragmentCount = takeString("fragment_count", "fragmentCount");

  const label = validationId
    ? `Validation ${formatId(validationId) ?? validationId}`
    : specHash
      ? `Validation ${formatId(specHash) ?? specHash}`
      : "Validation run";

  const descriptionParts: (string | undefined)[] = [];
  if (fragmentCount) {
    descriptionParts.push(`${fragmentCount} fragment${fragmentCount === "1" ? "" : "s"}`);
  }
  if (specHash) {
    descriptionParts.push(`Spec ${formatId(specHash) ?? specHash}`);
  }

  return createTargetInfo(
    `validation:${validationId ?? specHash ?? "general"}`,
    label,
    buildDescription(descriptionParts),
  );
};

// Version frozen handler
export const handleVersionFrozen: EventTypeHandler = (ctx) => {
  const { takeString } = ctx;
  const versionId = takeString("version_id", "versionId");
  const versionName = takeString("version_name", "versionName");
  const specHash = takeString("spec_hash", "specHash");

  const label =
    versionName ?? (versionId ? `Version ${formatId(versionId) ?? versionId}` : "Version frozen");

  const descriptionParts: (string | undefined)[] = [];
  if (versionId) {
    descriptionParts.push(`ID ${formatId(versionId) ?? versionId}`);
  }
  if (specHash) {
    descriptionParts.push(`Spec ${formatId(specHash) ?? specHash}`);
  }

  return createTargetInfo(
    `version:${versionId ?? versionName ?? "frozen"}`,
    label,
    buildDescription(descriptionParts),
  );
};

// Git push handler
export const handleGitPush: EventTypeHandler = (ctx) => {
  const { takeString } = ctx;
  const repository = takeString("repository");
  const branch = takeString("branch", "ref");
  const provider = takeString("provider");

  const branchLabel = branch ? (branch.split("/").pop() ?? branch) : undefined;
  const label = repository ? `Push · ${repository}` : "Git push";

  const descriptionParts = [
    branchLabel ? `Branch ${branchLabel}` : undefined,
    provider ? `via ${provider}` : undefined,
  ];

  return createTargetInfo(
    `git-push:${repository ?? "unknown"}:${branch ?? "general"}`,
    label,
    buildDescription(descriptionParts),
  );
};

// Git merge handler
export const handleGitMerge: EventTypeHandler = (ctx) => {
  const { takeString } = ctx;
  const repository = takeString("repository");
  const source = takeString("source_branch", "head_branch");
  const target = takeString("target_branch", "base_branch");
  const provider = takeString("provider");

  const label = repository ? `Merge · ${repository}` : "Git merge";
  const branches = source && target ? `${source} → ${target}` : undefined;

  const descriptionParts = [branches, provider ? `via ${provider}` : undefined];

  return createTargetInfo(
    `git-merge:${repository ?? "unknown"}:${target ?? "general"}`,
    label,
    buildDescription(descriptionParts),
  );
};

// Event head updated handler
export const handleEventHeadUpdated: EventTypeHandler = (ctx) => {
  const { takeString, data, event } = ctx;
  const headId = takeString("head_event_id");

  const resolved =
    (headId && resolveFromEventIds([headId], ctx)) ||
    resolveFromEventLike(data.head_event, `${event.id}-head`, ctx);

  if (resolved) {
    return resolved;
  }

  return createTimelineTarget(event.event_type, "Head updated");
};

// Events reverted handler
export const handleEventsReverted: EventTypeHandler = (ctx) => {
  const { getArray, data, event } = ctx;

  const resolved =
    resolveFromEventIds(getArray("reverted_event_ids"), ctx) ||
    resolveFromEventIds(getArray("reactivated_event_ids"), ctx) ||
    resolveFromEventLike(data.reverted_event, `${event.id}-reverted`, ctx) ||
    resolveFromEventArray(getArray("reverted_events"), "reverted", ctx);

  if (resolved) {
    return resolved;
  }

  return createTimelineTarget(event.event_type, "Events reverted");
};

// Events reapplied handler
export const handleEventsReapplied: EventTypeHandler = (ctx) => {
  const { getArray, data, event } = ctx;

  const resolved =
    resolveFromEventIds(getArray("reapplied_event_ids"), ctx) ||
    resolveFromEventIds(getArray("reactivated_event_ids"), ctx) ||
    resolveFromEventLike(data.reapplied_event, `${event.id}-reapplied`, ctx) ||
    resolveFromEventArray(getArray("reapplied_events"), "reapplied", ctx);

  if (resolved) {
    return resolved;
  }

  return createTimelineTarget(event.event_type, "Events reapplied");
};

// Entity created handler
export const handleEntityCreated: EventTypeHandler = (ctx) => {
  const { takeString } = ctx;
  const entityType = takeString("entity_type", "artifact_type");
  const name = takeString("name");
  const entityId = takeString("entity_id", "id");

  const baseLabel = entityType ? humanizeKey(entityType) : "Entity";
  const label = name ? `${baseLabel}: ${name}` : `${baseLabel} created`;
  const description = entityId ? `ID ${formatId(entityId) ?? entityId}` : undefined;

  return createTargetInfo(
    `entity:${entityType ?? "generic"}:${entityId ?? name ?? "created"}`,
    label,
    description,
  );
};

// Entity deleted handler
export const handleEntityDeleted: EventTypeHandler = (ctx) => {
  const { takeString } = ctx;
  const entityType = takeString("entity_type", "artifact_type");
  const name = takeString("name");
  const entityId = takeString("entity_id", "id");

  const baseLabel = entityType ? humanizeKey(entityType) : "Entity";
  const label = name ? `${baseLabel}: ${name}` : `${baseLabel} deleted`;
  const description = entityId ? `ID ${formatId(entityId) ?? entityId}` : undefined;

  return createTargetInfo(
    `entity:${entityType ?? "generic"}:${entityId ?? name ?? "deleted"}`,
    label,
    description,
  );
};

// Entity restored handler
export const handleEntityRestored: EventTypeHandler = (ctx) => {
  const { takeString } = ctx;
  const entityType = takeString("entity_type", "artifact_type");
  const name = takeString("name");
  const entityId = takeString("entity_id", "id");

  const baseLabel = entityType ? humanizeKey(entityType) : "Entity";
  const label = name ? `${baseLabel}: ${name}` : `${baseLabel} restored`;
  const description = entityId ? `ID ${formatId(entityId) ?? entityId}` : undefined;

  return createTargetInfo(
    `entity:${entityType ?? "generic"}:${entityId ?? name ?? "restored"}`,
    label,
    description,
  );
};

/**
 * Handler registry mapping event types to their handlers.
 */
export const eventTypeHandlers: Record<string, EventTypeHandler> = {
  fragment_created: handleFragmentEvents,
  fragment_updated: handleFragmentEvents,
  fragment_deleted: handleFragmentEvents,
  fragment_revision_created: handleFragmentEvents,
  validation_started: handleValidationEvents,
  validation_completed: handleValidationEvents,
  validation_failed: handleValidationEvents,
  version_frozen: handleVersionFrozen,
  git_push_processed: handleGitPush,
  git_merge_processed: handleGitMerge,
  event_head_updated: handleEventHeadUpdated,
  events_reverted: handleEventsReverted,
  events_reapplied: handleEventsReapplied,
  entity_created: handleEntityCreated,
  entity_deleted: handleEntityDeleted,
  entity_restored: handleEntityRestored,
};
