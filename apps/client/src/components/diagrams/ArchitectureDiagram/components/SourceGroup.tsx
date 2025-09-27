import StatusBadge from '@/design-system/components/StatusBadge';
import React from 'react';
import { ComponentCard } from './ComponentCard';

interface SourceGroupProps {
  groupLabel: string;
  components: Array<{ name: string; data: any }>;
  expandedSources: Record<string, boolean>;
  setExpandedSources: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onComponentClick: (name: string) => void;
}

export const SourceGroup: React.FC<SourceGroupProps> = ({
  groupLabel,
  components,
  expandedSources,
  setExpandedSources,
  onComponentClick,
}) => {
  const isExpanded = expandedSources[groupLabel];

  return (
    <div className="bg-white dark:bg-graphite-900 border border-gray-200 dark:border-graphite-700 rounded-lg overflow-hidden">
      {/* Group Header */}
      <button
        onClick={() => setExpandedSources(prev => ({ ...prev, [groupLabel]: !prev[groupLabel] }))}
        className="w-full px-4 py-3 bg-gray-50 dark:bg-graphite-800 border-b border-gray-200 dark:border-graphite-700 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-graphite-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <svg
              className="w-4 h-4 text-blue-600 dark:text-blue-400"
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
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="font-medium text-gray-900 dark:text-graphite-25 truncate mr-4"
              title={groupLabel}
            >
              {groupLabel}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {components.length > 0 && (
            <StatusBadge
              variant="secondary"
              style="solid"
              size="xs"
              className="rounded-full text-[10px] px-2 py-0.5 !bg-graphite-900 !text-graphite-200 !border-graphite-600"
            >
              {components.length}
            </StatusBadge>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 dark:text-graphite-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Components Grid */}
      {isExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {components.map(({ name, data }) => (
              <ComponentCard
                key={`${groupLabel}-${name}`}
                name={name}
                data={data}
                onClick={() => onComponentClick(name)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
