import { clsx } from 'clsx';
import React from 'react';

interface ErrorStateProps {
  error: string;
  className?: string;
  onRefresh?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, className = '', onRefresh }) => {
  const isNotFound = error.includes('not found') || error.includes('deleted');

  return (
    <div className={clsx('h-full overflow-auto bg-gray-50', className)}>
      <div className="p-4 bg-white border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Sources</h3>
        <p className="text-sm text-red-600">
          {isNotFound
            ? 'Project not found or has been deleted'
            : 'Error loading project architecture'}
        </p>
      </div>
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-400 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
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
          <p className="text-gray-900 font-medium mb-2">
            {isNotFound ? 'Project Deleted' : 'Failed to load architecture data'}
          </p>
          <p className="text-sm text-gray-600">{error}</p>
          {isNotFound && (
            <button
              onClick={onRefresh}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh Projects
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
