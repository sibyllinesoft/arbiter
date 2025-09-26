import { useProjectEvents, useRevertProjectEvents, useSetEventHead } from '@/hooks/api-hooks';
import type { Event } from '@/types/api';
import React, { useEffect, useMemo, useState } from 'react';

interface EventsReportProps {
  projectId: string;
}

export function EventsReport({ projectId }: EventsReportProps) {
  const { data, isLoading, isError, refetch } = useProjectEvents(projectId);
  const setHeadMutation = useSetEventHead(projectId);
  const revertMutation = useRevertProjectEvents(projectId);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const events = data?.events ?? [];
  const headEventId = data?.head_event_id ?? null;

  useEffect(() => {
    // Prune selected IDs that are no longer present in the list
    if (selectedIds.size === 0 || events.length === 0) return;
    const eventIds = new Set(events.map(event => event.id));
    let hasChanges = false;

    selectedIds.forEach(id => {
      if (!eventIds.has(id)) {
        selectedIds.delete(id);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setSelectedIds(new Set(selectedIds));
    }
  }, [events, selectedIds]);

  const activeCount = useMemo(() => events.filter(event => event.is_active).length, [events]);

  const danglingCount = events.length - activeCount;
  const selectedCount = selectedIds.size;

  const toggleSelected = (eventId: string) => {
    const next = new Set(selectedIds);
    if (next.has(eventId)) {
      next.delete(eventId);
    } else {
      next.add(eventId);
    }
    setSelectedIds(next);
  };

  const handleSetHead = (eventId: string | null) => {
    setHeadMutation.mutate(eventId, {
      onSuccess: () => {
        refetch();
      },
    });
  };

  const handleRevertEvents = async (eventIds: string[]) => {
    if (eventIds.length === 0) return;
    try {
      await revertMutation.mutateAsync(eventIds);
      setSelectedIds(new Set());
      refetch();
    } catch (
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _error
    ) {
      // Errors are surfaced through the mutation state; no-op here
    }
  };

  const isBusy = setHeadMutation.isPending || revertMutation.isPending;

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500">Loading event log…</div>;
  }

  if (isError || !data) {
    return <div className="p-4 text-sm text-red-500">Failed to load events. Please retry.</div>;
  }

  const renderStatusBadge = (event: Event) => {
    const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';

    if (event.id === headEventId) {
      return <span className={`${baseClasses} bg-blue-100 text-blue-700`}>Head</span>;
    }

    if (event.is_active) {
      return <span className={`${baseClasses} bg-green-100 text-green-700`}>Active</span>;
    }

    return <span className={`${baseClasses} bg-amber-100 text-amber-700`}>Dangling</span>;
  };

  const prettyPrintData = (event: Event) => {
    if (!event.data || Object.keys(event.data).length === 0) {
      return '—';
    }

    try {
      const json = JSON.stringify(event.data);
      if (json.length <= 80) {
        return json;
      }
      return `${json.substring(0, 77)}…`;
    } catch (error) {
      return 'Unserializable data';
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-gray-200 bg-white p-4 dark:border-graphite-700 dark:bg-graphite-950">
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-graphite-300">
          <span>
            Events: <strong>{events.length}</strong>
          </span>
          <span>
            Active: <strong>{activeCount}</strong>
          </span>
          <span>
            Dangling: <strong>{danglingCount}</strong>
          </span>
          <span>
            Selected: <strong>{selectedCount}</strong>
          </span>
          {headEventId && data.head_event ? (
            <span className="flex items-center gap-1">
              <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-graphite-400">
                Head
              </span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                {data.head_event.event_type}
              </span>
              <span className="text-xs text-gray-500 dark:text-graphite-400">
                {new Date(data.head_event.created_at).toLocaleString()}
              </span>
            </span>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              No head selected — journal will treat all events as active.
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            onClick={() => handleSetHead(events[0]?.id ?? null)}
            disabled={events.length === 0 || isBusy}
          >
            Roll forward to latest
          </button>
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handleRevertEvents(Array.from(selectedIds))}
            disabled={selectedCount === 0 || isBusy}
          >
            Revert selected
          </button>
          <button
            type="button"
            className="rounded border border-transparent px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedCount === 0 || isBusy}
          >
            Clear selection
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white dark:bg-graphite-950">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-graphite-800">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-graphite-900 dark:text-graphite-400">
            <tr>
              <th className="px-3 py-3 text-left">Select</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3 text-left">Event</th>
              <th className="px-3 py-3 text-left">Timestamp</th>
              <th className="px-3 py-3 text-left">Payload</th>
              <th className="px-3 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm dark:divide-graphite-800">
            {events.map(event => {
              const isSelected = selectedIds.has(event.id);
              const rowHighlight =
                event.id === headEventId
                  ? 'bg-blue-50 dark:bg-blue-500/10'
                  : event.is_active
                    ? 'bg-white dark:bg-graphite-950'
                    : 'bg-amber-50/60 dark:bg-amber-500/10';

              return (
                <tr key={event.id} className={`${rowHighlight}`}>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={isSelected}
                      onChange={() => toggleSelected(event.id)}
                      disabled={isBusy}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">{renderStatusBadge(event)}</td>
                  <td className="px-3 py-2 align-top font-medium text-gray-900 dark:text-graphite-50">
                    {event.event_type}
                    {!event.is_active && event.reverted_at ? (
                      <div className="text-xs text-gray-500 dark:text-graphite-400">
                        Reverted {new Date(event.reverted_at).toLocaleString()}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top text-gray-600 dark:text-graphite-300">
                    <div>{new Date(event.created_at).toLocaleString()}</div>
                  </td>
                  <td className="px-3 py-2 align-top text-gray-600 dark:text-graphite-300">
                    <code className="line-clamp-3 break-all text-xs">{prettyPrintData(event)}</code>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => handleSetHead(event.id)}
                        disabled={isBusy || event.id === headEventId}
                      >
                        Set head here
                      </button>
                      {event.is_active ? (
                        <button
                          type="button"
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => handleRevertEvents([event.id])}
                          disabled={isBusy}
                        >
                          Revert
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded border border-green-300 px-2 py-1 text-xs text-green-600 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => handleSetHead(event.id)}
                          disabled={isBusy}
                        >
                          Roll forward
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {events.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm text-gray-500 dark:text-graphite-400"
                >
                  No events recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
