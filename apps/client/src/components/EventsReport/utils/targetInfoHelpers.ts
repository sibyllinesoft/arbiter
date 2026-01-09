/**
 * @module EventsReport/utils/targetInfoHelpers
 * Helper functions for event target info extraction.
 */

import type { Event } from "@/types/api";
import { humanizeKey, toShortId } from "./formatting";

export type EventTargetInfo = {
  key: string;
  label: string;
  description?: string;
};

/**
 * Coerce a value to string, returning undefined for empty/null values.
 */
export const coerceToString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return undefined;
};

/**
 * Context for event target info resolution.
 */
export type GetEventTargetContext = {
  lookupEvent?: (eventId: string) => Event | undefined;
  seen?: Set<string>;
};

/**
 * Creates a helper to extract string values from event data.
 */
export const createStringExtractor = (data: Record<string, unknown>) => {
  return (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const candidate = coerceToString(data[key]);
      if (candidate) {
        return candidate;
      }
    }
    return undefined;
  };
};

/**
 * Creates a helper to extract arrays from event data.
 */
export const createArrayExtractor = (data: Record<string, unknown>) => {
  return (key: string): unknown[] => (Array.isArray(data[key]) ? (data[key] as unknown[]) : []);
};

/**
 * Builds a description string from parts.
 */
export const buildDescription = (parts: (string | undefined)[]): string | undefined => {
  const filtered = parts.filter((value): value is string => Boolean(value));
  return filtered.length ? filtered.join(" · ") : undefined;
};

/**
 * Creates a result object with optional description.
 */
export const createTargetInfo = (
  key: string,
  label: string,
  description?: string,
): EventTargetInfo => {
  const result: EventTargetInfo = { key, label };
  if (description) {
    result.description = description;
  }
  return result;
};

/**
 * Creates a timeline target info object.
 */
export const createTimelineTarget = (eventType: string, description: string): EventTargetInfo => ({
  key: `timeline:${eventType}`,
  label: "Timeline update",
  description,
});

/**
 * Formats an ID with short form if available.
 */
export const formatId = (id: string | undefined): string | undefined => {
  if (!id) return undefined;
  return toShortId(id) ?? id;
};

/**
 * Creates a default fallback target info for unknown event types.
 */
export const createDefaultTarget = (eventType: string): EventTargetInfo => ({
  key: `event-type:${eventType}`,
  label: humanizeKey(eventType),
});

/**
 * Creates a circular reference fallback target info.
 */
export const createCircularRefTarget = (eventId: string, eventType: string): EventTargetInfo => ({
  key: `event:${eventId}`,
  label: humanizeKey(eventType),
});
