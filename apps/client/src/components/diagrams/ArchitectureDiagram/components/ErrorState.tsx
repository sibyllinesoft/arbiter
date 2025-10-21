import { clsx } from "clsx";
import React from "react";

interface ErrorStateProps {
  error: string;
  className?: string;
  onRefresh?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, className = "", onRefresh }) => {
  const isNotFound = error.includes("not found") || error.includes("deleted");

  return (
    <div
      className={clsx(
        "h-full overflow-auto bg-white text-gray-700 transition-colors dark:bg-graphite-950 dark:text-graphite-200",
        className,
      )}
    >
      <div className="border-b border-gray-200 bg-gray-50 p-4 dark:border-graphite-700 dark:bg-graphite-900">
        <h3 className="text-lg font-medium text-gray-900 dark:text-graphite-50">Sources</h3>
        <p
          className={clsx(
            "text-sm",
            isNotFound ? "text-amber-600 dark:text-amber-300" : "text-red-600 dark:text-red-300",
          )}
        >
          {isNotFound
            ? "Project not found or has been deleted"
            : "Error loading project architecture"}
        </p>
      </div>
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-red-500 dark:text-red-300">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="font-medium text-gray-900 dark:text-graphite-50">
            {isNotFound ? "Project Deleted" : "Failed to load architecture data"}
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-graphite-300">{error}</p>
          {isNotFound && (
            <button
              onClick={onRefresh}
              className="mt-4 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Refresh Projects
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
