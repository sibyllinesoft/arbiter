import { clsx } from 'clsx';
import React from 'react';

interface LoadingStateProps {
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ className = '' }) => {
  return (
    <div className={clsx('h-full overflow-auto bg-gray-50', className)}>
      <div className="p-4 bg-white border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Sources</h3>
        <p className="text-sm text-gray-600">Loading project architecture...</p>
      </div>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading architecture data...</span>
      </div>
    </div>
  );
};
