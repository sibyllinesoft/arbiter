import { clsx } from "clsx";
import React from "react";

interface LoadingStateProps {
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ className = "" }) => {
  return (
    <div
      className={clsx(
        "h-full overflow-auto bg-white text-gray-700 transition-colors dark:bg-graphite-950 dark:text-graphite-200",
        className,
      )}
    >
      <div className="border-b border-gray-200 bg-gray-50 p-4 dark:border-graphite-700 dark:bg-graphite-900">
        <h3 className="text-lg font-medium text-gray-900 dark:text-graphite-50">Sources</h3>
        <p className="text-sm text-gray-600 dark:text-graphite-300">
          Loading project architecture...
        </p>
      </div>
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-graphite-700 dark:bg-graphite-900">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
          <span className="text-sm text-gray-600 dark:text-graphite-300">
            Loading architecture data...
          </span>
        </div>
      </div>
    </div>
  );
};
