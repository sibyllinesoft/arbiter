import type { Event } from "@/types/api";

export interface EventsReportProps {
  projectId: string;
}

export type DetailRow = { label: string; value: string };

export type EventTargetInfo = {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type EventGroup = {
  id: string;
  label: string;
  events: Event[];
};

export type EventCardProps = {
  event: Event;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete?: (eventId: string) => void;
  lookupEvent?: (eventId: string) => Event | undefined;
};

export type EventGroupCardProps = {
  group: EventGroup;
  isExpanded: boolean;
  onToggle: () => void;
  lookupEvent?: (eventId: string) => Event | undefined;
  onDelete?: (eventId: string) => void;
};
