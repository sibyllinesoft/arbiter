/**
 * EventCard component for displaying individual events
 */
import type { Event } from "@/types/api";
import {
  ChevronDown,
  ChevronRight,
  Info,
  Pencil,
  PlusCircle,
  RotateCcw,
  Trash2,
} from "lucide-react";
import React, { useMemo } from "react";
import { deriveEntityAttributes, extractDetailRows } from "../utils/detailExtraction";
import { formatEventSummary } from "../utils/eventSummary";
import { humanizeKey } from "../utils/formatting";
import { coerceToString } from "../utils/targetInfo";

export type EventCardProps = {
  event: Event;
  variant: "root" | "child";
  lookupEvent: (eventId: string) => Event | undefined;
  targetLabel?: string;
  targetDescription?: string;
  orderLabel?: string;
  history?: Event[];
  isExpanded?: boolean;
  onToggleHistory?: () => void;
  onRestore?: (event: Event) => void;
  isRestoring?: boolean;
};

export function EventCard({
  event,
  variant,
  lookupEvent,
  targetLabel,
  targetDescription,
  orderLabel,
  history,
  isExpanded,
  onToggleHistory,
  onRestore,
  isRestoring,
}: EventCardProps) {
  const detailRows = useMemo(() => extractDetailRows(event), [event]);
  const summary = useMemo(() => formatEventSummary(event, lookupEvent), [event, lookupEvent]);
  const entityAttributes = useMemo(() => deriveEntityAttributes(event), [event]);
  const filteredDetailRows = useMemo(() => {
    if (!detailRows.length) {
      return detailRows;
    }
    const suppressed = new Set<string>(
      ["Name", "Type", "ID", "Entity Id", "Artifact Id", "Entity Type", "Artifact Type"].map(
        (label) => label.toUpperCase(),
      ),
    );
    entityAttributes.forEach((attr) => suppressed.add(attr.label.toUpperCase()));
    return detailRows.filter((row) => !suppressed.has(row.label.toUpperCase()));
  }, [detailRows, entityAttributes]);

  const isHistorical = variant === "child";
  const normalizedType = event.event_type.toLowerCase();
  const isInactive = !event.is_active;
  const isReversionType = normalizedType.includes("revert");
  const showRevertedContainer = isInactive || isReversionType;
  const canRestore =
    !showRevertedContainer &&
    variant === "root" &&
    event.event_type === "entity_deleted" &&
    typeof onRestore === "function";
  const isRestoreInFlight = Boolean(isRestoring);

  const statusLabel = isHistorical ? "Historical" : isInactive ? "Reverted" : "Active";
  const statusClasses = isHistorical
    ? "bg-slate-200 text-slate-700 dark:bg-graphite-800 dark:text-graphite-200"
    : isInactive
      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
      : "bg-green-100 text-green-700 dark:bg-emerald-500/20 dark:text-emerald-200";

  const containerClasses = [
    "rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow",
    "dark:border-graphite-700 dark:bg-graphite-900 dark:shadow-none",
    variant === "child"
      ? "border-dashed bg-slate-50/70 p-3 dark:border-graphite-700 dark:bg-graphite-900/60"
      : "p-4",
  ]
    .filter(Boolean)
    .join(" ");

  const revertedWrapperClasses = [
    "rounded-xl border border-amber-300 bg-amber-50/60 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10",
    variant === "child" ? "p-3" : "p-4",
  ]
    .filter(Boolean)
    .join(" ");

  const iconSizeClass = variant === "child" ? "h-4 w-4" : "h-5 w-5";
  const iconWrapperClasses = [
    "flex items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-graphite-800 dark:text-graphite-200",
    variant === "child" ? "mt-0.5 h-7 w-7" : "mt-1 h-8 w-8",
  ]
    .filter(Boolean)
    .join(" ");

  const historyCount = history?.length ?? 0;
  const totalStates = historyCount + 1;
  const stackLabel =
    variant === "root" && totalStates > 1
      ? `Stack · ${totalStates} state${totalStates === 1 ? "" : "s"}`
      : undefined;

  const icon = useMemo(() => {
    if (isInactive || isReversionType) {
      return <RotateCcw className={`${iconSizeClass} text-amber-500`} />;
    }
    if (normalizedType.includes("restored")) {
      return <RotateCcw className={`${iconSizeClass} text-emerald-500`} />;
    }
    if (normalizedType.includes("created")) {
      return <PlusCircle className={`${iconSizeClass} text-emerald-500`} />;
    }
    if (normalizedType.includes("updated") || normalizedType.includes("revision")) {
      return <Pencil className={`${iconSizeClass} text-blue-500`} />;
    }
    if (normalizedType.includes("deleted")) {
      return <Trash2 className={`${iconSizeClass} text-rose-500`} />;
    }
    return <Info className={`${iconSizeClass} text-slate-400`} />;
  }, [iconSizeClass, isInactive, isReversionType, normalizedType]);

  const nestedRevertedEvent = useMemo(() => {
    if (!showRevertedContainer) return null;

    const data = (event.data ?? {}) as Record<string, unknown>;

    const normalizeEventLike = (value: unknown, suffix: string): Event | null => {
      if (!value || typeof value !== "object") return null;
      const raw = value as Partial<Event> & Record<string, unknown>;
      const eventType =
        typeof raw.event_type === "string"
          ? (raw.event_type as Event["event_type"])
          : event.event_type;
      return {
        id: String(raw.id ?? `${event.id}-${suffix}`),
        project_id: String(raw.project_id ?? event.project_id),
        event_type: eventType,
        data: raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : {},
        is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
        reverted_at: typeof raw.reverted_at === "string" ? raw.reverted_at : null,
        created_at: typeof raw.created_at === "string" ? raw.created_at : event.created_at,
      } satisfies Event;
    };

    const fromIds = (value: unknown): Event | null => {
      if (!Array.isArray(value) || !lookupEvent) return null;
      for (const entry of value) {
        const id = coerceToString(entry);
        if (!id) continue;
        const resolved = lookupEvent(id);
        if (resolved) return resolved;
      }
      return null;
    };

    const candidate =
      normalizeEventLike(data.reverted_event, "reverted") ||
      normalizeEventLike(data.reapplied_event, "reapplied") ||
      normalizeEventLike(data.head_event, "head") ||
      (Array.isArray(data.reverted_events)
        ? normalizeEventLike(data.reverted_events[0], "reverted-array")
        : null) ||
      (Array.isArray(data.reapplied_events)
        ? normalizeEventLike(data.reapplied_events[0], "reapplied-array")
        : null) ||
      fromIds(data.reverted_event_ids) ||
      fromIds(data.reapplied_event_ids) ||
      fromIds(data.reactivated_event_ids);

    if (candidate && candidate.id === event.id) {
      return null;
    }

    return candidate ?? null;
  }, [event, lookupEvent, showRevertedContainer]);

  const hasDetailRows = filteredDetailRows.length > 0;
  const shouldShowSummary = !hasDetailRows && !nestedRevertedEvent && summary;

  const renderDetailRows = () => {
    if (!hasDetailRows) {
      return shouldShowSummary ? (
        <div className="rounded border border-slate-200/80 bg-slate-50/80 p-3 text-sm text-slate-700 dark:border-graphite-700 dark:bg-graphite-900 dark:text-graphite-100">
          {summary}
        </div>
      ) : null;
    }

    return (
      <dl className="grid gap-x-8 gap-y-3 text-sm text-gray-700 dark:text-graphite-100 sm:grid-cols-2">
        {filteredDetailRows.map((row, index) => (
          <div key={`${row.label}-${row.value}-${index}`} className="flex items-start gap-3">
            <dt className="mt-0.5 w-28 shrink-0 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-graphite-400">
              {row.label}
            </dt>
            <dd className="flex-1 font-semibold text-gray-900 dark:text-graphite-50">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    );
  };

  const restoreButton = canRestore ? (
    <button
      type="button"
      onClick={(eventObj) => {
        eventObj.stopPropagation();
        onRestore?.(event);
      }}
      disabled={isRestoreInFlight}
      className="inline-flex items-center gap-1 rounded-full border border-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-400/60 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
    >
      <RotateCcw className="h-3 w-3" />
      {isRestoreInFlight ? "Restoring…" : "Restore"}
    </button>
  ) : null;

  const historyToggle =
    historyCount > 0 && onToggleHistory ? (
      <button
        type="button"
        className="mt-0.5 rounded border border-transparent p-1 text-gray-500 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring dark:text-graphite-300 dark:hover:bg-graphite-800"
        onClick={onToggleHistory}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse previous states" : "Expand previous states"}
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
    ) : null;
  const historyToggleAdornment = historyToggle ?? <div className="mt-0.5 h-4 w-4" />;

  const historyContent =
    historyCount > 0 && isExpanded ? (
      <div className="mt-4 space-y-3 border-t border-dashed border-gray-200 pt-4 dark:border-graphite-700">
        {(history ?? []).map((historyEvent, index) => (
          <EventCard
            key={historyEvent.id}
            event={historyEvent}
            variant="child"
            lookupEvent={lookupEvent}
            orderLabel={`State ${index + 2}/${totalStates}`}
          />
        ))}
      </div>
    ) : null;

  const nestedContent =
    showRevertedContainer && nestedRevertedEvent && variant === "root" ? (
      <div className="mt-3 space-y-3 border-l border-amber-300/60 pl-3 dark:border-amber-500/30">
        <EventCard event={nestedRevertedEvent} variant="child" lookupEvent={lookupEvent} />
      </div>
    ) : null;

  return (
    <div
      className={[
        showRevertedContainer ? revertedWrapperClasses : "",
        !showRevertedContainer ? containerClasses : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showRevertedContainer ? (
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          <span>Reverted</span>
          {event.reverted_at ? (
            <span className="font-normal normal-case text-amber-600 dark:text-amber-200">
              {new Date(event.reverted_at).toLocaleString()}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className={showRevertedContainer ? containerClasses : undefined}>
        {targetLabel ? (
          <div className="mb-3 flex items-start gap-2">
            {historyToggleAdornment}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-graphite-50">
                  {targetLabel}
                </span>
                {stackLabel ? (
                  <span className="text-xs font-medium text-gray-500 dark:text-graphite-400">
                    {stackLabel}
                  </span>
                ) : null}
              </div>
              {targetDescription ? (
                <div className="text-xs text-gray-500 dark:text-graphite-300">
                  {targetDescription}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <div
          className={
            targetLabel
              ? "border-t border-dashed border-gray-200 pt-3 dark:border-graphite-700"
              : undefined
          }
        >
          <div className="flex items-start gap-3">
            <div className={iconWrapperClasses}>{icon}</div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-graphite-50">
                  {humanizeKey(event.event_type)}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClasses}`}
                >
                  {statusLabel}
                </span>
                {orderLabel ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-graphite-800/80 dark:text-graphite-200">
                    {orderLabel}
                  </span>
                ) : null}
                {restoreButton}
              </div>
              <div className="text-xs text-gray-500 dark:text-graphite-300">
                {new Date(event.created_at).toLocaleString()}
              </div>
              {entityAttributes.length > 0 ? (
                <div className="flex w-full flex-wrap items-center gap-4 text-sm text-gray-900 dark:text-graphite-50">
                  {entityAttributes.map((attr) => (
                    <span
                      key={`${attr.label}-${attr.value}`}
                      className="flex flex-1 basis-[160px] items-center gap-2"
                    >
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-graphite-300">
                        {attr.label}:
                      </span>
                      <span className="text-sm font-normal">{attr.value}</span>
                    </span>
                  ))}
                </div>
              ) : null}
              {renderDetailRows()}
            </div>
          </div>
          {nestedContent}
          {historyContent}
        </div>
      </div>
    </div>
  );
}
