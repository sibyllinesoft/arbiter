/**
 * @module EventsReport/utils/targetInfo
 * Event target info extraction utilities.
 */

import type { Event } from "@/types/api";
import { type HandlerContext, eventTypeHandlers } from "./targetInfoHandlers";
import {
  type EventTargetInfo,
  type GetEventTargetContext,
  coerceToString,
  createArrayExtractor,
  createCircularRefTarget,
  createDefaultTarget,
  createStringExtractor,
} from "./targetInfoHelpers";

// Re-export types for backward compatibility
export type { EventTargetInfo, GetEventTargetContext };
export { coerceToString };

/**
 * Get target info for an event (used for grouping and display).
 */
export const getEventTargetInfo = (
  event: Event,
  context: GetEventTargetContext = {},
): EventTargetInfo => {
  const data = (event.data ?? {}) as Record<string, unknown>;
  const { lookupEvent } = context;
  const seen = context.seen ?? new Set<string>();

  // Handle circular references
  if (seen.has(event.id)) {
    return createCircularRefTarget(event.id, event.event_type);
  }
  seen.add(event.id);

  // Create handler context
  const handlerContext: HandlerContext = {
    event,
    data,
    takeString: createStringExtractor(data),
    getArray: createArrayExtractor(data),
    lookupEvent,
    seen,
    getEventTargetInfo,
  };

  // Look up handler for this event type
  const handler = eventTypeHandlers[event.event_type];
  if (handler) {
    const result = handler(handlerContext);
    if (result) {
      return result;
    }
  }

  // Default fallback for unknown event types
  return createDefaultTarget(event.event_type);
};
