import { clsx } from 'clsx';
import React from 'react';

interface EmptyStateProps {
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ className = '' }) => {
  return (
    <div className={clsx('text-center py-8', className)}>
      <div className="text-gray-400 mb-4">
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">No Components Found</h3>
      <p className="text-gray-600">Import a project to see its architecture components</p>
    </div>
  );
};
