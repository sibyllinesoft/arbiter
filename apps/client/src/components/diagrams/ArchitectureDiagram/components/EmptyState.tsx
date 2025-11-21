import { clsx } from "clsx";
import React from "react";

interface EmptyStateProps {
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ className = "" }) => {
  return (
    <div className={clsx("text-center py-12 px-6", className)}>
      <div className="text-gray-400 dark:text-graphite-500 mb-4">
        <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-graphite-25 mb-2">
        No Architecture Components Yet
      </h3>
      <p className="text-gray-600 dark:text-graphite-400 mb-6 max-w-md mx-auto">
        Your project doesn't have any components defined. Get started by defining your architecture
        in CUE.
      </p>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5 max-w-lg mx-auto text-left">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Next Steps:
        </h4>
        <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside">
          <li>Create or import a project with a CUE specification</li>
          <li>
            Define services, databases, and other components in your{" "}
            <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">arbiter.assembly.cue</code>
          </li>
          <li>
            Run <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">arbiter generate</code>{" "}
            to create visualizations
          </li>
          <li>Return here to see your architecture diagram</li>
        </ol>
      </div>

      <div className="mt-6">
        <a
          href="/docs/getting-started"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm inline-flex items-center gap-1"
        >
          View Documentation
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
};
