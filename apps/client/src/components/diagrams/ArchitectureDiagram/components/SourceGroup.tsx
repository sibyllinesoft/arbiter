import React from 'react';
import { ComponentCard } from './ComponentCard';

interface SourceGroupProps {
  sourceFile: string;
  components: Array<{ name: string; data: any }>;
  expandedSources: Record<string, boolean>;
  setExpandedSources: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onComponentClick: (name: string) => void;
}

export const SourceGroup: React.FC<SourceGroupProps> = ({
  sourceFile,
  components,
  expandedSources,
  setExpandedSources,
  onComponentClick,
}) => {
  const isExpanded = expandedSources[sourceFile];

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Source File Header */}
      <button
        onClick={() => setExpandedSources(prev => ({ ...prev, [sourceFile]: !prev[sourceFile] }))}
        className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <svg
              className="w-4 h-4 text-blue-600"
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
          <div className="text-left">
            <h3 className="font-medium text-gray-900" title={sourceFile}>
              {sourceFile.length > 30 ? `${sourceFile.substring(0, 27)}...` : sourceFile}
            </h3>
            <p className="text-sm text-gray-600">
              {components.length} component{components.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Components Grid */}
      {isExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {components.map(({ name, data }) => (
              <ComponentCard
                key={`${sourceFile}-${name}`}
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
