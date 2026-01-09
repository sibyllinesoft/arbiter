import { clsx } from "clsx";
import { ChevronUp, Layout, Plus, Trash2 } from "lucide-react";
import React, { type FC, useState } from "react";

import { ARTIFACT_PANEL_CLASS } from "../../core/ArtifactPanel";
import type { NormalizedClient } from "../types";

export const ClientCard: FC<{
  client: NormalizedClient;
  onDelete?: (client: NormalizedClient) => void;
  onAddView?: (client: NormalizedClient) => void;
  disableAddView?: boolean;
}> = ({ client, onDelete, onAddView, disableAddView = false }) => {
  const [expanded, setExpanded] = useState(true);

  const handleToggle = () => setExpanded((previous) => !previous);
  const handleDelete = () => {
    if (onDelete) {
      onDelete(client);
    }
  };
  const handleAddView = () => {
    onAddView?.(client);
  };

  const deleteDisabled = typeof onDelete !== "function";
  const addViewDisabled = disableAddView || typeof onAddView !== "function";

  return (
    <div className={clsx(ARTIFACT_PANEL_CLASS, "overflow-hidden font-medium")}>
      <div className="border-b border-graphite-200/60 bg-gray-100 px-3 py-2 dark:border-graphite-700/60 dark:bg-graphite-900/70">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={expanded}
            className="flex flex-1 items-center gap-3 px-1 py-1.5 text-left font-semibold transition-colors hover:text-graphite-900 dark:hover:text-graphite-25"
          >
            <Layout className="h-4 w-4 text-gray-900 dark:text-white" />
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              {client.displayName || client.identifier}
            </span>
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleAddView}
              className={clsx(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
                addViewDisabled
                  ? "cursor-not-allowed text-gray-400 dark:text-graphite-500"
                  : "text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-400/10",
              )}
              disabled={addViewDisabled}
              aria-label="Add view"
            >
              <Plus
                className={clsx(
                  "h-4 w-4",
                  addViewDisabled
                    ? "text-gray-400 dark:text-graphite-500"
                    : "text-blue-600 dark:text-blue-300",
                )}
              />
              <span className="hidden sm:inline">Add view</span>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Delete client"
              className={clsx(
                "p-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-rose-500",
                deleteDisabled
                  ? "cursor-not-allowed text-gray-400 dark:text-graphite-500"
                  : "text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-400/10",
              )}
              disabled={deleteDisabled}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleToggle}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse client details" : "Expand client details"}
              className="p-2 rounded-md text-gray-500 hover:text-graphite-900 hover:bg-gray-100 dark:text-graphite-300 dark:hover:text-graphite-25 dark:hover:bg-graphite-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
            >
              <ChevronUp
                className={clsx(
                  "h-4 w-4 transition-transform",
                  expanded ? "rotate-180" : "rotate-0",
                )}
              />
            </button>
          </div>
        </div>
        <div
          className={clsx(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            expanded ? "max-h-[320px] opacity-100" : "max-h-0 opacity-0 pointer-events-none",
          )}
          aria-hidden={!expanded}
        >
          <div className="mt-3 space-y-4 text-sm">
            {client.description && (
              <p className="text-gray-600/80 dark:text-graphite-200/80">{client.description}</p>
            )}
            <div className="flex flex-wrap justify-around gap-4 text-sm bg-white dark:bg-graphite-950">
              {client.metadataItems.map((item) => (
                <div
                  key={`${client.identifier}-${item.label}`}
                  className="flex items-baseline gap-1 text-gray-700/80 dark:text-graphite-200/80"
                >
                  <span className="uppercase tracking-wide text-[11px] font-medium text-gray-500/80 dark:text-graphite-300/80">
                    {item.label}:
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className={clsx(
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
          expanded ? "max-h-[680px] opacity-100" : "max-h-0 opacity-0 pointer-events-none",
        )}
        aria-hidden={!expanded}
      >
        <div className="px-5 py-4 font-medium bg-white dark:bg-graphite-950">
          {client.views.length > 0 ? (
            <div className="space-y-3">
              {client.views.map((view, idx) => (
                <React.Fragment key={view.key}>
                  <div className="space-y-1 rounded-md px-1 py-1 text-sm">
                    <span className="block font-semibold text-blue-600 dark:text-blue-400">
                      {view.path}
                    </span>
                    {view.component && (
                      <div className="text-xs text-gray-600/80 dark:text-graphite-200/80">
                        Component:{" "}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {view.component}
                        </span>
                      </div>
                    )}
                    {view.filePath && (
                      <div className="text-xs text-gray-500/80 dark:text-graphite-300/80">
                        {view.filePath}
                      </div>
                    )}
                  </div>
                  {idx < client.views.length - 1 ? (
                    <hr className="border-graphite-200/40 dark:border-graphite-700/40" />
                  ) : null}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-graphite-300 text-center">
              No views present.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
