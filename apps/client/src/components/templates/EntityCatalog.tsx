import { Button } from "@/design-system";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import React from "react";

interface EntityCatalogProps<T> {
  title: string;
  description?: string;
  icon: LucideIcon;
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  addAction?: {
    label: string;
    onAdd: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  isLoading?: boolean;
  emptyMessage: string;
}

export function EntityCatalog<T>({
  title,
  description,
  icon: Icon,
  items,
  renderCard,
  addAction,
  isLoading = false,
  emptyMessage,
}: EntityCatalogProps<T>) {
  return (
    <div className="flex flex-1 overflow-hidden min-h-0 flex-col">
      <div className="border-b border-graphite-200/60 bg-gray-100 px-6 py-6 dark:border-graphite-700/60 dark:bg-graphite-900/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center text-blue-600 dark:text-blue-200">
              <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25">{title}</h2>
              {description ? (
                <p className="text-sm text-gray-600 dark:text-graphite-300">{description}</p>
              ) : null}
            </div>
          </div>
          {addAction ? (
            <Button
              type="button"
              onClick={addAction.onAdd}
              disabled={addAction.disabled || isLoading}
              loading={addAction.loading ?? false}
              className={clsx(
                "inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors",
                "hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                "disabled:cursor-not-allowed disabled:bg-blue-400 disabled:text-blue-100",
              )}
            >
              <Plus className="h-4 w-4" />
              {addAction.label}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-transparent">
        <div className="space-y-6">
          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-graphite-300">Loading...</p>
          ) : items.length > 0 ? (
            <div className="overflow-hidden font-medium">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {items.map(renderCard)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-graphite-300">{emptyMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default EntityCatalog;
// @ts-nocheck
