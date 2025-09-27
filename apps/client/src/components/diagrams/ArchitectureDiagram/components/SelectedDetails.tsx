import { Modal } from '@/components/Modal';
import React from 'react';
import type { GroupedComponentGroup } from '../utils';

interface SelectedDetailsProps {
  selectedComponent: string | null;
  groupedComponents: GroupedComponentGroup[];
  onClose: () => void;
}

export const SelectedDetails: React.FC<SelectedDetailsProps> = ({
  selectedComponent,
  groupedComponents,
  onClose,
}) => {
  if (!selectedComponent) return null;

  // Find the selected component in the grouped data
  const selectedData = (() => {
    for (const group of groupedComponents) {
      const found = group.items.find(({ name }) => name === selectedComponent);
      if (found) {
        return { ...found, groupLabel: group.label };
      }
    }
    return null;
  })();

  if (!selectedData) return null;

  return (
    <Modal
      isOpen={!!selectedComponent}
      onClose={onClose}
      title={selectedData.data.name || selectedData.name}
      maxWidth="2xl"
      maxHeight="90vh"
      className="dark:bg-graphite-950"
    >
      {/* Type/Language/Framework row */}
      <div className="flex flex-wrap gap-6 mb-4">
        {/* Language */}
        {selectedData.data.metadata?.language &&
          selectedData.data.metadata.language !== 'unknown' &&
          selectedData.data.metadata.language.trim() !== '' && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Language
              </span>
              <p className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded whitespace-pre-wrap break-words">
                {selectedData.data.metadata.language}
              </p>
            </div>
          )}
        {/* Framework */}
        {selectedData.data.metadata?.framework &&
          selectedData.data.metadata.framework !== 'unknown' &&
          selectedData.data.metadata.framework.trim() !== '' && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Framework
              </span>
              <p className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded whitespace-pre-wrap break-words">
                {selectedData.data.metadata.framework}
              </p>
            </div>
          )}
      </div>

      {/* Full metadata display */}
      <div className="space-y-4">
        {selectedData.data.description && (
          <div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">
              {selectedData.data.description}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {Object.entries(selectedData.data)
            .map(([key, value]) => {
              if (
                key === 'name' ||
                key === 'description' ||
                key === 'type' ||
                key === 'language' ||
                key === 'framework' ||
                !value
              )
                return null;
              // Render metadata sub-items vertically, filtering language/framework
              if (key === 'metadata' && typeof value === 'object') {
                const metadata = value as any;
                return Object.entries(metadata)
                  .map(([metaKey, metaValue]) => {
                    if (metaKey === 'language' || metaKey === 'framework' || !metaValue)
                      return null;
                    return (
                      <div key={`${key}-${metaKey}`}>
                        <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          {metaKey}
                        </h5>
                        <p className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded whitespace-pre-wrap break-words overflow-auto max-h-64">
                          {typeof metaValue === 'object'
                            ? JSON.stringify(metaValue, null, 2)
                            : String(metaValue)}
                        </p>
                      </div>
                    );
                  })
                  .filter(Boolean);
              }
              return (
                <div key={key}>
                  <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    {key}
                  </h5>
                  <p className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded whitespace-pre-wrap break-words overflow-auto max-h-64">
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                  </p>
                </div>
              );
            })
            .filter(Boolean)}
        </div>
      </div>
    </Modal>
  );
};
