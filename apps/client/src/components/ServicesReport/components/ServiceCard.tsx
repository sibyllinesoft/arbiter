import { ArtifactCard } from "@/components/ArtifactCard";
import { ARTIFACT_PANEL_BODY_CLASS, ARTIFACT_PANEL_CLASS } from "@/components/ArtifactPanel";
import { clsx } from "clsx";
import { ChevronDown, ChevronUp, Navigation, Plus } from "lucide-react";
import React, { useState } from "react";
import { TYPE_ICON_STYLES } from "../constants";
import type { NormalizedEndpointCard, NormalizedService } from "../types";

interface ServiceCardProps {
  service: NormalizedService;
  onAddEndpoint: (service: NormalizedService) => void;
  onEditEndpoint: (service: NormalizedService, endpoint: NormalizedEndpointCard) => void;
  onEditService: (service: NormalizedService) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onAddEndpoint,
  onEditEndpoint,
  onEditService,
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasDistinctName = Boolean(
    service.displayName && service.displayName.toLowerCase() !== service.identifier.toLowerCase(),
  );

  const handleToggle = () => setExpanded((prev) => !prev);
  const handleAddEndpoint = () => {
    onAddEndpoint(service);
  };
  const handleCardClick = () => {
    onEditService(service);
  };
  const [showSourcePath, setShowSourcePath] = useState(false);
  const sourcePath =
    service.sourcePath ?? service.metadataItems.find((item) => item.label === "Source")?.value;
  const metadataWithoutSource = service.metadataItems.filter((item) => item.label !== "Source");

  return (
    <div
      className={clsx(ARTIFACT_PANEL_CLASS, "overflow-hidden font-medium cursor-pointer")}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleCardClick();
        }
      }}
    >
      <div className="border-b border-graphite-200/60 bg-gray-100 px-3 py-2 dark:border-graphite-700/60 dark:bg-graphite-900/70">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleToggle();
            }}
            aria-expanded={expanded}
            className="flex flex-1 items-center gap-3 px-1 py-1.5 text-left font-semibold transition-colors hover:text-graphite-900 dark:hover:text-graphite-25"
          >
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  "flex h-10 w-10 items-center justify-center",
                  service.typeLabel
                    ? (TYPE_ICON_STYLES[service.typeLabel.toLowerCase()] ??
                        "text-indigo-600 dark:text-indigo-200")
                    : "text-indigo-600 dark:text-indigo-200",
                )}
              >
                <Navigation className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {service.displayName || service.identifier}
              </h3>
              {hasDistinctName && (
                <span className="font-mono text-xs lowercase text-gray-400 dark:text-graphite-400">
                  {service.identifier}
                </span>
              )}
            </div>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleAddEndpoint();
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-400/10"
            aria-label="Add endpoint"
          >
            <Plus className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            <span className="hidden sm:inline">Add endpoint</span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleToggle();
            }}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse service details" : "Expand service details"}
            className="flex items-center justify-center rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200/60 hover:text-graphite-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1 dark:text-graphite-300 dark:hover:bg-graphite-800/70 dark:hover:text-graphite-50 dark:focus-visible:ring-offset-0"
          >
            <ChevronUp
              className={clsx("h-4 w-4 transition-transform", expanded ? "rotate-180" : "rotate-0")}
            />
          </button>
        </div>
        <div
          className={clsx(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            expanded ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0 pointer-events-none",
          )}
          aria-hidden={!expanded}
        >
          <div className="mt-3 space-y-4">
            <div className="flex flex-wrap items-start justify-around gap-4">
              {service.description ? (
                <p className="text-sm leading-relaxed text-gray-600/70 dark:text-graphite-200/70 max-w-prose flex-1 basis-full md:basis-[55%] font-medium">
                  {service.description}
                </p>
              ) : null}
              <div className="flex flex-1 min-w-[220px] flex-wrap justify-around gap-4 font-medium text-sm">
                {metadataWithoutSource.length > 0 &&
                  metadataWithoutSource.map((item) => (
                    <div
                      key={`${service.key}-${item.label}`}
                      className="flex items-baseline gap-1 text-gray-700/80 dark:text-graphite-200/80"
                    >
                      <span className="uppercase tracking-wide text-[11px] font-medium text-gray-500/80 dark:text-graphite-300/80">
                        {item.label}:
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {item.value}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {sourcePath && (
              <div className="rounded-md border border-graphite-200/50 bg-white/80 dark:border-graphite-700/60 dark:bg-graphite-900/40">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowSourcePath((prev) => !prev);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:text-blue-600 dark:text-graphite-100 dark:hover:text-blue-300"
                >
                  <span>Source</span>
                  <ChevronDown
                    className={clsx(
                      "h-4 w-4 transition-transform",
                      showSourcePath ? "rotate-180" : "rotate-0",
                    )}
                  />
                </button>
                {showSourcePath && (
                  <pre className="max-h-64 overflow-auto border-t border-graphite-200/50 bg-gray-950/90 px-3 py-2 text-xs text-gray-100 dark:border-graphite-700/60 dark:bg-graphite-900/80">
                    <code className="whitespace-pre-wrap font-mono">{sourcePath}</code>
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={clsx(
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
          expanded ? "max-h-[720px] opacity-100" : "max-h-0 opacity-0 pointer-events-none",
        )}
        aria-hidden={!expanded}
      >
        <div className={clsx(ARTIFACT_PANEL_BODY_CLASS, "px-3 py-3 md:px-4 md:py-4 font-medium")}>
          {service.endpoints.length > 0 ? (
            <div className="mt-2 grid gap-3 grid-cols-1">
              {service.endpoints.map((endpoint) => (
                <ArtifactCard
                  key={endpoint.key}
                  name={endpoint.name}
                  data={endpoint.data}
                  onClick={() => onEditEndpoint(service, endpoint)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-center text-gray-500 dark:text-graphite-300">
              No endpoints detected for this service.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
