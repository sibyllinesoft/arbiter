/**
 * EventGroupCard component for displaying grouped events
 */
import type { Event } from "@/types/api";
import React from "react";
import type { EventTargetInfo } from "../utils/targetInfo";
import { EventCard } from "./EventCard";

export type EventGroup = {
  target: EventTargetInfo;
  current: Event;
  previous: Event[];
};

export type EventGroupCardProps = {
  group: EventGroup;
  expanded: boolean;
  onToggle: () => void;
  lookupEvent: (eventId: string) => Event | undefined;
  onRestore?: (event: Event) => void;
  restoringEvents?: Set<string>;
};

export function EventGroupCard({
  group,
  expanded,
  onToggle,
  lookupEvent,
  onRestore,
  restoringEvents,
}: EventGroupCardProps) {
  const { current, previous, target } = group;
  const totalStates = previous.length + 1;
  const isRestoring = restoringEvents?.has(current.id) ?? false;
  const restoreHandler =
    current.event_type === "entity_deleted" && typeof onRestore === "function"
      ? onRestore
      : undefined;

  return (
    <EventCard
      event={current}
      variant="root"
      lookupEvent={lookupEvent}
      targetLabel={target.label}
      {...(target.description ? { targetDescription: target.description } : {})}
      orderLabel={totalStates > 1 ? `Current state · 1/${totalStates}` : "Current state"}
      history={previous}
      {...(expanded ? { isExpanded: true } : {})}
      {...(previous.length > 0 ? { onToggleHistory: onToggle } : {})}
      {...(restoreHandler ? { onRestore: restoreHandler } : {})}
      isRestoring={isRestoring}
    />
  );
}
