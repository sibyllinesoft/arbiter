/**
 * Event detail extraction utilities
 */
import type { Event } from "@/types/api";
import { emphasizeLabel, formatValue, humanizeKey } from "./formatting";

export type DetailRow = { label: string; value: string };

/**
 * Extract detail rows from an event for display
 */
export const extractDetailRows = (event: Event): DetailRow[] => {
  const data = (event.data ?? {}) as Record<string, unknown>;
  const rows: DetailRow[] = [];

  const coerceString = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  };

  const addRow = (label: string, value: unknown) => {
    const formatted = formatValue(value);
    if (!label || !formatted || formatted === "n/a") return;
    rows.push({ label: emphasizeLabel(label), value: formatted });
  };

  const addFromValues = (values: unknown, prefix?: string) => {
    if (!values || typeof values !== "object") return;
    Object.entries(values as Record<string, unknown>).forEach(([key, val]) => {
      addRow(prefix ? `${prefix} ${key}` : key, val);
    });
  };

  const changes = data.changes;
  if (changes && typeof changes === "object") {
    Object.entries(changes as Record<string, unknown>).forEach(([key, change]) => {
      if (
        change &&
        typeof change === "object" &&
        "before" in (change as Record<string, unknown>) &&
        "after" in (change as Record<string, unknown>)
      ) {
        const entry = change as { before: unknown; after: unknown };
        const before = formatValue(entry.before);
        const after = formatValue(entry.after);
        rows.push({ label: emphasizeLabel(key), value: `${before} → ${after}` });
      } else {
        addRow(key, change);
      }
    });
  }

  if (rows.length === 0 && data.values && typeof data.values === "object") {
    addFromValues(data.values);
  }

  const importantKeys = [
    "name",
    "path",
    "fragment_path",
    "fragment_id",
    "entity_id",
    "artifact_id",
    "entity_type",
    "artifact_type",
    "restored_from_event_id",
    "deleted_at",
    "restored_at",
    "user",
    "user_id",
    "author",
    "description",
    "status",
  ];

  const suppressedKeys = new Set([
    "name",
    "entity_id",
    "artifact_id",
    "entity_type",
    "artifact_type",
  ]);

  importantKeys.forEach((key) => {
    if (suppressedKeys.has(key)) {
      return;
    }
    if (key in data) {
      addRow(key, data[key]);
    }
  });

  return rows;
};

/**
 * Derive entity attributes from an event for display
 */
export const deriveEntityAttributes = (event: Event): Array<{ label: string; value: string }> => {
  const data = (event.data ?? {}) as Record<string, unknown>;
  const coerceString = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  };

  const attributes: Array<{ label: string; value: string }> = [];
  const name = coerceString(data.name);
  const type =
    coerceString(data.entity_type) ??
    coerceString(data.artifact_type) ??
    coerceString(event.data?.type);
  const id =
    coerceString(data.entity_id) ??
    coerceString(data.artifact_id) ??
    coerceString(data.id) ??
    undefined;

  if (name) {
    attributes.push({ label: "Name", value: name });
  }
  if (type) {
    attributes.push({ label: "Type", value: humanizeKey(type) });
  }
  if (id) {
    attributes.push({ label: "ID", value: id });
  }

  return attributes;
};
