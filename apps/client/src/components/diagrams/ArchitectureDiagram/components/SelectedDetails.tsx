import { clsx } from 'clsx';
import React from 'react';

interface SelectedDetailsProps {
  selectedComponent: string | null;
  groupedComponents: Record<string, any[]>;
  onClose: () => void;
}

export const SelectedDetails: React.FC<SelectedDetailsProps> = ({
  selectedComponent,
  groupedComponents,
  onClose,
}) => {
  if (!selectedComponent) return null;

  // Find the selected component in the grouped data
  let selectedData = null;
  for (const [sourceFile, components] of Object.entries(groupedComponents)) {
    const found = components.find(({ name }) => name === selectedComponent);
    if (found) {
      selectedData = { ...found, sourceFile };
      break;
    }
  }

  if (!selectedData) return null;

  return (
    <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-900">
          {selectedData.data.name || selectedData.name}
        </h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-3">Source: {selectedData.sourceFile}</p>

      {/* Full metadata display */}
      <div className="space-y-3">
        {selectedData.data.description && (
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-1">Description:</h5>
            <p className="text-sm text-gray-600">{selectedData.data.description}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(selectedData.data).map(([key, value]) => {
            if (key === 'name' || key === 'description' || !value) return null;
            return (
              <div key={key}>
                <h5 className="text-sm font-medium text-gray-700 mb-1 capitalize">{key}:</h5>
                <p className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
