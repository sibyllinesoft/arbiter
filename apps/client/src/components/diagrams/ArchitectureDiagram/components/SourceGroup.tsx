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
  package: "text-purple-500 dark:text-purple-300",
  tool: "text-red-500 dark:text-red-300",
  route: "text-indigo-500 dark:text-indigo-300",
  view: "text-[#725718] dark:text-[#d8b66f]",
  database: "text-amber-500 dark:text-amber-300",
  infrastructure: "text-emerald-500 dark:text-emerald-300",
  frontend: "text-teal-500 dark:text-teal-300",
  flow: "text-sky-500 dark:text-sky-300",
  capability: "text-pink-500 dark:text-pink-300",
  group: "text-rose-500 dark:text-rose-300",
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
  const singularLabelLower = singularLabel.toLowerCase();
  const toggleLabel = `Toggle ${groupLabel}`;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-2 py-1">
        <button
          type="button"
          onClick={hasComponents ? handleToggle : undefined}
          className={clsx(
            "flex flex-1 items-center gap-3 rounded-md px-1.5 py-1 text-left text-gray-800 transition-colors dark:text-graphite-50",
            hasComponents
              ? "hover:bg-gray-100 dark:hover:bg-graphite-800"
              : "cursor-default opacity-60",
          )}
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
              className="truncate font-medium text-gray-900 dark:text-graphite-25"
              title={groupLabel}
            >
              {groupLabel}
            </h3>
          </div>
          {hasComponents && (
            <svg
              className={clsx(
                "w-4 h-4 text-gray-400 transition-transform dark:text-graphite-400",
                isExpanded ? "rotate-180" : "",
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </button>

        {hasComponents && (
          <StatusBadge
            variant="secondary"
            style="solid"
            size="xs"
            className="rounded-full px-2 py-0.5"
          >
            {components.length}
          </StatusBadge>
        )}

        {onAddClick ? (
          <button
            type="button"
            onClick={handleAddClick}
            aria-label={addButtonLabel}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add {singularLabelLower}</span>
          </button>
        ) : null}
      </div>

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
              isExpanded ? "opacity-100 delay-75" : "opacity-0 pointer-events-none",
            )}
          >
            <div className="px-2 pb-2 md:px-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
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
    </section>
  );
};
