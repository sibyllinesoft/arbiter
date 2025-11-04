import { ARTIFACT_PANEL_BODY_CLASS, ARTIFACT_PANEL_CLASS } from "@/components/ArtifactPanel";
import StatusBadge from "@/design-system/components/StatusBadge";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { PlusCircle } from "lucide-react";
import React from "react";
import { ComponentCard } from "./ComponentCard";

interface SourceGroupProps {
  groupLabel: string;
  components: Array<{ name: string; data: any }>;
  expandedSources: Record<string, boolean>;
  setExpandedSources: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onComponentClick: (payload: { name: string; data: any }) => void;
  icon?: LucideIcon;
  groupType?: string;
  onAddClick?: () => void;
  onDeleteComponent?: (payload: { artifactId: string; label?: string }) => void;
}

const DEFAULT_ICON_COLOR = "text-gray-500 dark:text-gray-300";

const ICON_COLOR_MAP: Record<string, string> = {
  service: "text-blue-500 dark:text-blue-300",
  module: "text-purple-500 dark:text-purple-300",
  tool: "text-red-500 dark:text-red-300",
  route: "text-indigo-500 dark:text-indigo-300",
  view: "text-[#725718] dark:text-[#d8b66f]",
  database: "text-amber-500 dark:text-amber-300",
  infrastructure: "text-emerald-500 dark:text-emerald-300",
  frontend: "text-teal-500 dark:text-teal-300",
  flow: "text-sky-500 dark:text-sky-300",
  capability: "text-pink-500 dark:text-pink-300",
  epic: "text-rose-500 dark:text-rose-300",
  task: "text-slate-500 dark:text-slate-300",
};

const getIconColorClass = (groupType?: string): string => {
  const candidate = groupType ? ICON_COLOR_MAP[groupType] : undefined;
  if (typeof candidate === "string") {
    return candidate;
  }
  return DEFAULT_ICON_COLOR;
};

export const SourceGroup: React.FC<SourceGroupProps> = ({
  groupLabel,
  components,
  expandedSources,
  setExpandedSources,
  onComponentClick,
  icon: Icon,
  groupType,
  onAddClick,
  onDeleteComponent,
}) => {
  const hasComponents = components.length > 0;
  const isExpanded = hasComponents ? (expandedSources[groupLabel] ?? false) : false;
  const iconColorClass = getIconColorClass(groupType);
  const handleToggle = () => {
    if (!hasComponents) {
      return;
    }
    setExpandedSources((prev) => ({ ...prev, [groupLabel]: !prev[groupLabel] }));
  };

  const handleAddClick = () => {
    if (onAddClick) {
      onAddClick();
    }
  };

  const singularLabel = (() => {
    const trimmed = groupLabel.trim();
    if (!trimmed) return "item";
    if (/ies$/i.test(trimmed)) return trimmed.replace(/ies$/i, "y");
    if (/s$/i.test(trimmed)) return trimmed.replace(/s$/i, "");
    return trimmed;
  })();
  const addButtonLabel = `Add ${singularLabel}`;
  const toggleLabel = `Toggle ${groupLabel}`;

  return (
    <div className={clsx(ARTIFACT_PANEL_CLASS, "overflow-hidden")}>
      {/* Group Header */}
      <div className="flex items-center gap-3 border-b border-graphite-200/60 bg-gray-50 px-2 py-1.5 dark:border-graphite-700/60 dark:bg-graphite-900/70">
        <button
          type="button"
          onClick={hasComponents ? handleToggle : undefined}
          className="flex-1 flex items-center gap-3 text-left hover:text-graphite-900 dark:hover:text-graphite-25 transition-colors"
          aria-expanded={hasComponents ? isExpanded : undefined}
          aria-label={hasComponents ? toggleLabel : undefined}
          aria-disabled={hasComponents ? undefined : true}
          tabIndex={hasComponents ? undefined : -1}
        >
          <div className="flex items-center justify-center">
            {Icon ? (
              <Icon className={clsx("w-5 h-5", iconColorClass)} />
            ) : (
              <svg
                className={clsx("w-5 h-5", iconColorClass)}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="font-medium text-gray-900 dark:text-graphite-25 truncate"
              title={groupLabel}
            >
              {groupLabel}
            </h3>
          </div>
        </button>

        {hasComponents && (
          <StatusBadge
            variant="secondary"
            style="solid"
            size="xs"
            className="rounded-full text-[10px] px-2 py-0.5 !bg-graphite-900 !text-graphite-200 !border-graphite-600"
          >
            {components.length}
          </StatusBadge>
        )}

        <button
          type="button"
          onClick={handleAddClick}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-graphite-600 hover:text-graphite-900 hover:bg-gray-100 dark:text-graphite-200 dark:hover:text-graphite-25 dark:hover:bg-graphite-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 disabled:opacity-40"
          title={addButtonLabel}
          aria-label={addButtonLabel}
          disabled={!onAddClick}
        >
          <PlusCircle className="w-5 h-5 text-graphite-500 dark:text-graphite-200" />
        </button>

        <button
          type="button"
          onClick={hasComponents ? handleToggle : undefined}
          className={clsx(
            "p-2 rounded-md text-gray-500 hover:text-graphite-900 hover:bg-gray-100 dark:text-graphite-300 dark:hover:text-graphite-25 dark:hover:bg-graphite-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500",
            !hasComponents && "invisible pointer-events-none",
          )}
          aria-label={hasComponents ? toggleLabel : undefined}
          aria-expanded={hasComponents ? isExpanded : undefined}
          disabled={!hasComponents}
        >
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Components Grid */}
      {hasComponents && (
        <div
          className={clsx(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
          aria-hidden={!isExpanded}
        >
          <div
            className={clsx(
              "overflow-hidden transition-opacity duration-200 ease-out",
              isExpanded ? "opacity-100 delay-100" : "opacity-0 pointer-events-none",
            )}
          >
            <div className={clsx(ARTIFACT_PANEL_BODY_CLASS, "px-3 py-3 md:px-4 md:py-4")}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {components.map(({ name, data }) => {
                  const displayLabel =
                    typeof data?.name === "string" && data.name.trim() ? data.name : name;
                  const potentialIds = [
                    data?.artifactId,
                    data?.id,
                    data?.metadata?.artifactId,
                    data?.metadata?.artifact_id,
                  ];
                  const artifactIdRaw = potentialIds.find(
                    (value) => typeof value === "string" && value.trim().length > 0,
                  ) as string | undefined;
                  const artifactId = artifactIdRaw?.trim();
                  const onDelete =
                    artifactId && onDeleteComponent
                      ? () => onDeleteComponent({ artifactId, label: displayLabel })
                      : undefined;

                  return (
                    <ComponentCard
                      key={`${groupLabel}-${name}`}
                      name={name}
                      data={data}
                      onClick={() => onComponentClick({ name, data })}
                      {...(onDelete ? { onDelete } : {})}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
