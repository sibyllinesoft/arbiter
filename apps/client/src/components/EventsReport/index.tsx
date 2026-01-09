/**
 * EventsReport - Main component for displaying project events
 */
import { useTabBadgeUpdater } from "@/contexts/TabBadgeContext";
import { useProjectEvents } from "@/hooks/api-hooks";
import { useWebSocketEvent } from "@/hooks/useWebSocket";
import { apiService } from "@/services/api";
import type { NormalizedWebSocketEvent } from "@/services/websocket";
import type { Event } from "@/types/api";
import { Database } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { type EventGroup, EventGroupCard } from "./components/EventGroupCard";
import { sortEventsDesc } from "./utils/formatting";
import { type EventTargetInfo, coerceToString, getEventTargetInfo } from "./utils/targetInfo";

interface EventsReportProps {
  projectId: string;
}

export function EventsReport({ projectId }: EventsReportProps) {
  const { data, isLoading, isError, refetch } = useProjectEvents(projectId);

  const [eventLog, setEventLog] = useState<Event[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [restoringEvents, setRestoringEvents] = useState<Set<string>>(new Set());
  const updateRestoringEvents = useCallback((eventId: string, shouldAdd: boolean) => {
    setRestoringEvents((prev) => {
      const next = new Set(prev);
      if (shouldAdd) {
        next.add(eventId);
      } else {
        next.delete(eventId);
      }
      return next;
    });
  }, []);

  const eventById = useMemo(() => {
    const map = new Map<string, Event>();
    eventLog.forEach((item) => map.set(item.id, item));
    return map;
  }, [eventLog]);

  const lookupEvent = useCallback((eventId: string) => eventById.get(eventId), [eventById]);
  const tabBadgeUpdater = useTabBadgeUpdater();
  const eventCount = isLoading || isError ? null : eventLog.length;

  useEffect(() => {
    if (!projectId) {
      tabBadgeUpdater("events", null);
      return () => {
        tabBadgeUpdater("events", null);
      };
    }
    if (eventCount == null) {
      tabBadgeUpdater("events", null);
      return () => {
        tabBadgeUpdater("events", null);
      };
    }
    tabBadgeUpdater("events", eventCount);
    return () => {
      tabBadgeUpdater("events", null);
    };
  }, [eventCount, projectId, tabBadgeUpdater]);

  useEffect(() => {
    if (!Array.isArray(data?.events)) return;

    setEventLog((prev) => {
      const merged = new Map<string, Event>();
      data.events.forEach((event) => merged.set(event.id, event));
      prev.forEach((event) => {
        if (!merged.has(event.id)) {
          merged.set(event.id, event);
        }
      });
      return sortEventsDesc(Array.from(merged.values()));
    });
  }, [data]);

  const handleRealtimeEvent = useCallback(
    (message: NormalizedWebSocketEvent) => {
      const targetProjectId = message.projectId ?? projectId ?? undefined;
      if (projectId && targetProjectId && targetProjectId !== projectId) {
        return;
      }

      const raw = message.event;
      const eventId = coerceToString(raw.id);
      const eventType = message.type;

      if (!eventId || !eventType) {
        return;
      }

      const createdAt =
        coerceToString(raw.created_at) ?? coerceToString(raw.timestamp) ?? new Date().toISOString();

      const rawData = raw.data;
      const isActiveRaw = (raw as Record<string, unknown>)["is_active"];
      const revertedAtRaw = (raw as Record<string, unknown>)["reverted_at"];

      const eventData: Event = {
        id: eventId,
        project_id: String(targetProjectId ?? projectId ?? ""),
        event_type: eventType as Event["event_type"],
        data: rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {},
        is_active:
          typeof isActiveRaw === "boolean"
            ? isActiveRaw
            : typeof isActiveRaw === "string"
              ? isActiveRaw === "true"
              : true,
        reverted_at:
          typeof revertedAtRaw === "string" && revertedAtRaw.trim() ? revertedAtRaw : null,
        created_at: createdAt,
      };

      setEventLog((prev) => {
        let updated = prev;
        if (eventData.event_type === "entity_restored") {
          const restoredFromId = coerceToString(eventData.data?.restored_from_event_id);
          if (restoredFromId) {
            updated = prev.map((item) =>
              item.id === restoredFromId ? { ...item, is_active: false } : item,
            );
          }
        }
        if (updated.some((event) => event.id === eventId)) {
          return sortEventsDesc(updated);
        }
        return sortEventsDesc([eventData, ...updated]);
      });

      refetch();
    },
    [projectId, refetch],
  );

  useWebSocketEvent("*", handleRealtimeEvent);

  const groupedEvents = useMemo(() => {
    const lookupFromMap = (eventId: string) => eventById.get(eventId);
    const groups = new Map<string, Event[]>();

    eventLog.forEach((event) => {
      const target = getEventTargetInfo(event, { lookupEvent: lookupFromMap });
      const existing = groups.get(target.key);
      if (existing) {
        existing.push(event);
      } else {
        groups.set(target.key, [event]);
      }
    });

    const prepared = Array.from(groups.entries())
      .map(([, events]) => {
        const sorted = [...events].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        if (sorted.length === 0) {
          return null;
        }
        const current = sorted.find((item) => item.is_active) ?? sorted[0]!;
        const previous = sorted.filter((item) => item.id !== current.id);
        return {
          target: getEventTargetInfo(current, { lookupEvent: lookupFromMap }),
          current,
          previous,
        } satisfies EventGroup;
      })
      .filter((group): group is EventGroup => group !== null);

    return prepared.sort(
      (a, b) => new Date(b.current.created_at).getTime() - new Date(a.current.created_at).getTime(),
    );
  }, [eventById, eventLog]);

  useEffect(() => {
    const validKeys = new Set(
      groupedEvents.filter((group) => group.previous.length > 0).map((group) => group.target.key),
    );
    setExpandedGroups((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((key) => {
        if (validKeys.has(key)) {
          next.add(key);
        } else {
          changed = true;
        }
      });
      if (!changed && next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [groupedEvents]);

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const handleRestoreEvent = useCallback(
    async (event: Event) => {
      const artifactId =
        coerceToString(event.data?.artifact_id) ?? coerceToString(event.data?.entity_id);
      const snapshot = event.data?.snapshot;
      if (!artifactId) {
        console.error(
          "[EventsReport] Unable to restore entity: missing artifact identifier",
          event,
        );
        if (typeof window !== "undefined" && typeof window.alert === "function") {
          window.alert("Unable to restore entity: missing artifact identifier");
        }
        return;
      }
      if (!snapshot || typeof snapshot !== "object") {
        console.error("[EventsReport] Unable to restore entity: missing snapshot payload", event);
        if (typeof window !== "undefined" && typeof window.alert === "function") {
          window.alert("Unable to restore entity: missing snapshot data");
        }
        return;
      }

      updateRestoringEvents(event.id, true);
      try {
        await apiService.restoreProjectEntity(projectId, artifactId, {
          snapshot: snapshot as Record<string, unknown>,
          eventId: event.id,
        });
        setEventLog((prev) =>
          prev.map((item) => (item.id === event.id ? { ...item, is_active: false } : item)),
        );
        await refetch();
      } catch (error) {
        console.error("[EventsReport] Failed to restore entity", error);
        if (typeof window !== "undefined" && typeof window.alert === "function") {
          window.alert("Failed to restore entity. Please try again.");
        }
      } finally {
        updateRestoringEvents(event.id, false);
      }
    },
    [projectId, refetch, updateRestoringEvents],
  );

  const activeCount = useMemo(() => eventLog.filter((event) => event.is_active).length, [eventLog]);
  const danglingCount = eventLog.length - activeCount;
  const stackCount = groupedEvents.length;

  if (isLoading && eventLog.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 text-sm text-gray-500 dark:bg-graphite-950 dark:text-graphite-300">
        Loading event log…
      </div>
    );
  }

  if ((isError && eventLog.length === 0) || (!data && eventLog.length === 0)) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 text-sm text-red-500 dark:bg-graphite-950">
        Failed to load events. Please retry.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950">
      <div className="border-b border-graphite-200/60 bg-gray-100 px-6 py-6 dark:border-graphite-700/60 dark:bg-graphite-900/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center text-amber-600 dark:text-amber-200">
              <Database className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25">
                Event Log
              </h2>
              <p className="text-sm text-gray-600 dark:text-graphite-300">
                Monitor project activity, drill into changes, and restore earlier states when
                necessary.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-graphite-300">
            <span>
              Events:{" "}
              <strong className="text-gray-900 dark:text-graphite-25">{eventLog.length}</strong>
            </span>
            <span>
              Active: <strong className="text-gray-900 dark:text-graphite-25">{activeCount}</strong>
            </span>
            <span>
              Reverted:{" "}
              <strong className="text-gray-900 dark:text-graphite-25">{danglingCount}</strong>
            </span>
            <span>
              Stacks: <strong className="text-gray-900 dark:text-graphite-25">{stackCount}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 py-6">
        {eventLog.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-graphite-300">
            No events recorded yet.
          </div>
        ) : (
          <div className="space-y-6 overflow-y-auto">
            {groupedEvents.map((group) => (
              <EventGroupCard
                key={group.target.key}
                group={group}
                expanded={expandedGroups.has(group.target.key)}
                onToggle={() => toggleGroup(group.target.key)}
                lookupEvent={lookupEvent}
                onRestore={handleRestoreEvent}
                restoringEvents={restoringEvents}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default EventsReport;
