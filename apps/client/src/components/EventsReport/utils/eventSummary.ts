import type { Event } from "@/types/api";
import {
  formatDuration,
  formatValue,
  humanizeKey,
  summarizeGeneric,
  toShortId,
} from "./formatting";

type EventFormatterContext = {
  event: Event;
  data: Record<string, unknown>;
  getString: (key: string) => string | undefined;
  getNumber: (key: string) => number | undefined;
  getArray: (key: string) => unknown[];
  join: (...parts: (string | undefined)[]) => string;
  describeById: (id?: string) => string | undefined;
  describeEventLike: (value: unknown, fallbackId?: string) => string | undefined;
  fragmentLabel: string;
  user?: string;
};

type EventFormatter = (context: EventFormatterContext) => string | undefined;

/** Describe a list of event IDs with their descriptions */
function describeEventList(
  ids: string[],
  described: string[],
  action: string,
  fallback: string,
  join: (...parts: (string | undefined)[]) => string,
): string {
  if (described.length === 1) {
    return `${action} "${described[0]}"`;
  }
  if (described.length > 1) {
    const preview = described
      .slice(0, 2)
      .map((item) => `"${item}"`)
      .join(", ");
    const suffix = described.length > 2 ? ` +${described.length - 2} more` : "";
    return `${action} ${ids.length} events (${preview}${suffix})`;
  }
  const count = ids.length;
  const idPreview = count
    ? `(${ids
        .slice(0, 2)
        .map((id) => toShortId(String(id)))
        .join(", ")}${count > 2 ? "…" : ""})`
    : undefined;
  return join(`${action} ${count} event${count === 1 ? "" : "s"}`, idPreview) || fallback;
}

const EVENT_FORMATTERS: Partial<Record<Event["event_type"], EventFormatter>> = {
  fragment_created: ({ fragmentLabel, user, getNumber, join }) => {
    const contentLength = getNumber("content_length");
    const createdLabel =
      fragmentLabel === "fragment" ? "Added fragment" : `Added fragment ${fragmentLabel}`;
    return (
      join(
        createdLabel,
        user ? `by ${user}` : undefined,
        contentLength ? `${contentLength.toLocaleString()} chars` : undefined,
      ) || "Added fragment"
    );
  },
  fragment_updated: ({ fragmentLabel, user, getString, getNumber, data, join }) => {
    const revisionIdValue = getString("revision_id");
    const revisionNumberValue = getNumber("revision_number");
    const revision = revisionIdValue
      ? toShortId(revisionIdValue)
      : revisionNumberValue !== undefined
        ? revisionNumberValue.toString()
        : undefined;
    const length = getNumber("content_length");
    const changes =
      data.changes && typeof data.changes === "object" ? formatValue(data.changes) : undefined;
    const updatedLabel =
      fragmentLabel === "fragment" ? "Updated fragment" : `Updated fragment ${fragmentLabel}`;
    return (
      join(
        updatedLabel,
        revision ? `rev ${revision}` : undefined,
        user ? `by ${user}` : undefined,
        length ? `${length.toLocaleString()} chars` : undefined,
        changes ? `changes: ${changes}` : undefined,
      ) || "Updated fragment"
    );
  },
  fragment_deleted: ({ fragmentLabel, user, join }) =>
    join(
      fragmentLabel === "fragment" ? "Deleted fragment" : `Deleted fragment ${fragmentLabel}`,
      user ? `by ${user}` : undefined,
    ) || "Deleted fragment",
  fragment_revision_created: ({ fragmentLabel, getNumber, getString, user, join }) => {
    const revisionNumberValue = getNumber("revision_number");
    const revisionIdValue = getString("revision_id");
    const message = getString("message");
    const author = getString("author");
    const contentHash = getString("content_hash");
    return (
      join(
        fragmentLabel === "fragment"
          ? "Saved fragment revision"
          : `Saved revision for ${fragmentLabel}`,
        revisionNumberValue !== undefined
          ? `rev ${revisionNumberValue}`
          : revisionIdValue
            ? `rev ${toShortId(revisionIdValue)}`
            : undefined,
        author ? `by ${author}` : user ? `by ${user}` : undefined,
        message,
        contentHash ? `hash ${toShortId(contentHash)}` : undefined,
      ) || "Fragment revision created"
    );
  },
  validation_started: ({ getNumber, user, join }) => {
    const count = getNumber("fragment_count");
    return (
      join(
        "Validation started",
        count !== undefined ? `${count} fragment${count === 1 ? "" : "s"}` : undefined,
        user ? `by ${user}` : undefined,
      ) || "Validation started"
    );
  },
  validation_completed: ({ getNumber, getString, user, join }) => {
    const errors = getNumber("error_count");
    const warnings = getNumber("warning_count");
    const specHash = getString("spec_hash");
    const duration = formatDuration(getNumber("duration_ms"));
    return (
      join(
        errors
          ? `${errors} error${errors === 1 ? "" : "s"}`
          : "Validation completed without errors",
        warnings ? `${warnings} warning${warnings === 1 ? "" : "s"}` : undefined,
        specHash ? `spec ${toShortId(specHash)}` : undefined,
        duration ? `in ${duration}` : undefined,
        user ? `by ${user}` : undefined,
      ) || "Validation completed"
    );
  },
  validation_failed: ({ getString, getNumber, user, join }) => {
    const specHash = getString("spec_hash");
    const failureReason = getString("failure_reason");
    const errors = getNumber("error_count");
    const warnings = getNumber("warning_count");
    return (
      join(
        "Validation failed",
        specHash ? `spec ${toShortId(specHash)}` : undefined,
        failureReason,
        errors ? `${errors} errors` : undefined,
        warnings ? `${warnings} warnings` : undefined,
        user ? `by ${user}` : undefined,
      ) || "Validation failed"
    );
  },
  version_frozen: ({ getString, user, join }) => {
    const versionName = getString("version_name");
    const versionId = getString("version_id");
    const description = getString("description");
    const specHash = getString("spec_hash");
    return (
      join(
        versionName ? `Frozen version "${versionName}"` : "Version frozen",
        versionId ? `id ${toShortId(versionId)}` : undefined,
        specHash ? `spec ${toShortId(specHash)}` : undefined,
        description,
        user ? `by ${user}` : undefined,
      ) || "Version frozen"
    );
  },
  git_push_processed: ({ getNumber, getString, join }) => {
    const commits = getNumber("commits");
    const ref = getString("ref");
    const repository = getString("repository");
    const provider = getString("provider");
    return (
      join(
        `Processed ${commits ?? 0} commit${commits === 1 ? "" : "s"}`,
        ref ? `on ${ref}` : undefined,
        repository ? `repo ${repository}` : undefined,
        provider ? `via ${provider}` : undefined,
      ) || "Processed git push"
    );
  },
  git_merge_processed: ({ getString, join }) => {
    const action = getString("action");
    const source = getString("head_branch");
    const target = getString("base_branch");
    const provider = getString("provider");
    const pr = getString("pr_id");
    return (
      join(
        action ? `${action.charAt(0).toUpperCase()}${action.slice(1)} merge` : "Merge processed",
        source && target ? `${source} → ${target}` : undefined,
        pr ? `PR ${toShortId(pr)}` : undefined,
        provider ? `via ${provider}` : undefined,
      ) || "Processed merge event"
    );
  },
  event_head_updated: ({ getString, describeEventLike, describeById, getArray, join, data }) => {
    const headId = getString("head_event_id");
    const headSummary =
      describeEventLike((data as Record<string, unknown>).head_event, headId ?? undefined) ??
      describeById(headId) ??
      (headId ? toShortId(headId) : undefined);
    const base = headSummary
      ? `Head set to "${headSummary}"`
      : headId
        ? `Head set to ${toShortId(headId)}`
        : "Head updated";
    const reactivated = getArray("reactivated_event_ids").length;
    const deactivated = getArray("deactivated_event_ids").length;
    return (
      join(
        base,
        reactivated ? `re-activated ${reactivated}` : undefined,
        deactivated ? `deactivated ${deactivated}` : undefined,
      ) || base
    );
  },
  events_reverted: ({ getArray, describeById, getString, join }) => {
    const revertedIds = getArray("reverted_event_ids").map((id) => String(id));
    const headId = getString("head_event_id");
    const described = revertedIds
      .map((id) => describeById(id))
      .filter((value): value is string => Boolean(value));
    const description = describeEventList(
      revertedIds,
      described,
      "Reverted",
      "Events reverted",
      join,
    );
    return headId ? `${description} · head now ${toShortId(headId)}` : description;
  },
  events_reapplied: ({ getArray, describeById, join }) => {
    const reappliedIds = getArray("reapplied_event_ids").map((id) => String(id));
    if (reappliedIds.length === 0) {
      reappliedIds.push(...getArray("reactivated_event_ids").map((id) => String(id)));
    }
    const described = reappliedIds
      .map((id) => describeById(id))
      .filter((value): value is string => Boolean(value));
    return describeEventList(reappliedIds, described, "Reapplied", "Events reapplied", join);
  },
  entity_created: ({ getString, data, join }) => {
    const entityType = getString("entity_type") ?? getString("artifact_type");
    const name = getString("name");
    const values =
      data.values && typeof data.values === "object" ? formatValue(data.values) : undefined;
    return (
      join(
        entityType ? `Added ${humanizeKey(entityType)}` : "Entity created",
        name ? `"${name}"` : undefined,
        values ? `values: ${values}` : undefined,
      ) || "Entity created"
    );
  },
  entity_deleted: ({ getString, join }) => {
    const entityType = getString("entity_type") ?? getString("artifact_type");
    const name = getString("name");
    const reason = getString("reason") ?? getString("source");
    return (
      join(
        entityType ? `Removed ${humanizeKey(entityType)}` : "Entity deleted",
        name ? `"${name}"` : undefined,
        reason ? `(${reason})` : undefined,
      ) || "Entity deleted"
    );
  },
  entity_restored: ({ getString, join }) => {
    const entityType = getString("entity_type") ?? getString("artifact_type");
    const name = getString("name");
    const sourceEvent = getString("restored_from_event_id");
    return (
      join(
        entityType ? `Restored ${humanizeKey(entityType)}` : "Entity restored",
        name ? `"${name}"` : undefined,
        sourceEvent ? `from ${toShortId(sourceEvent) ?? sourceEvent}` : undefined,
      ) || "Entity restored"
    );
  },
};

/** Extract a string value from event data */
function getStringFromData(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}

/** Extract a number value from event data */
function getNumberFromData(data: Record<string, unknown>, key: string): number | undefined {
  const value = data[key];
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

/** Extract an array value from event data */
function getArrayFromData(data: Record<string, unknown>, key: string): unknown[] {
  return Array.isArray(data[key]) ? (data[key] as unknown[]) : [];
}

/** Join non-empty parts with a separator */
function joinParts(...parts: (string | undefined)[]): string {
  const filtered = parts.filter(Boolean) as string[];
  return filtered.length > 0 ? filtered.join(" · ") : "";
}

/** Normalize an event-like object to a full Event */
function normalizeEventLike(
  value: unknown,
  fallbackId: string | undefined,
  parentEvent: Event,
): Event | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Event> & Record<string, unknown>;
  const type = raw.event_type;
  if (!type || typeof type !== "string") return null;
  return {
    id: String(raw.id ?? fallbackId ?? `${parentEvent.id}-ref`),
    project_id: String(raw.project_id ?? parentEvent.project_id),
    event_type: type as Event["event_type"],
    data: raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : {},
    is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
    reverted_at: raw.reverted_at ?? null,
    created_at: typeof raw.created_at === "string" ? raw.created_at : parentEvent.created_at,
  };
}

/** Build formatter context from event */
function buildFormatterContext(
  event: Event,
  data: Record<string, unknown>,
  lookupEvent: ((eventId: string) => Event | undefined) | undefined,
  seen: Set<string>,
): EventFormatterContext {
  const getString = (key: string) => getStringFromData(data, key);
  const getNumber = (key: string) => getNumberFromData(data, key);
  const getArray = (key: string) => getArrayFromData(data, key);

  const describeById = (id?: string): string | undefined => {
    if (!id || !lookupEvent) return undefined;
    const referenced = lookupEvent(id);
    if (!referenced) return undefined;
    return formatEventSummary(referenced, lookupEvent, new Set(seen));
  };

  const describeEventLike = (value: unknown, fallbackId?: string): string | undefined => {
    const normalized = normalizeEventLike(value, fallbackId, event);
    if (!normalized) return undefined;
    return formatEventSummary(normalized, lookupEvent, new Set(seen));
  };

  const fragmentPath = getString("fragment_path") ?? getString("path");
  const fragmentId = getString("fragment_id");
  const fragmentLabel = fragmentPath ?? toShortId(fragmentId) ?? "fragment";
  const user = getString("user_id") ?? getString("author") ?? getString("user");

  return {
    event,
    data,
    getString,
    getNumber,
    getArray,
    join: joinParts,
    describeById,
    describeEventLike,
    fragmentLabel,
    ...(user ? { user } : {}),
  };
}

export const formatEventSummary = (
  event: Event,
  lookupEvent?: (eventId: string) => Event | undefined,
  seen: Set<string> = new Set(),
): string => {
  if (seen.has(event.id)) {
    return event.event_type;
  }
  seen.add(event.id);

  const data = (event.data ?? {}) as Record<string, unknown>;
  const formatter = EVENT_FORMATTERS[event.event_type];

  if (!formatter) {
    return summarizeGeneric(data);
  }

  const context = buildFormatterContext(event, data, lookupEvent, seen);
  const summary = formatter(context);

  return summary || summarizeGeneric(data);
};
