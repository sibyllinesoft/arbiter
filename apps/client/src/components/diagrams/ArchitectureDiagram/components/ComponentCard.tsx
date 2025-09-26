import { clsx } from 'clsx';
import React from 'react';
import { LAYER_COLORS } from '../constants';

interface ComponentCardProps {
  name: string;
  data: any;
  onClick: () => void;
}

export const ComponentCard: React.FC<ComponentCardProps> = ({ name, data, onClick }) => {
  const normalizedType = (data.type || data.metadata?.type || '').toLowerCase();

  const colorKey = (() => {
    switch (normalizedType) {
      case 'service':
      case 'route':
        return 'service';
      case 'view':
        return 'frontend';
      case 'module':
        return 'module';
      case 'tool':
        return 'tool';
      case 'infrastructure':
      case 'database':
        return 'data';
      case 'frontend':
        return 'frontend';
      case 'backend':
        return 'backend';
      default:
        return 'external';
    }
  })();

  const colors = LAYER_COLORS[colorKey as keyof typeof LAYER_COLORS] || LAYER_COLORS.external;
  const isModuleOrTool = normalizedType === 'module' || normalizedType === 'tool';
  const rawDescription =
    data.description ?? data.metadata?.description ?? data.metadata?.summary ?? null;
  const descriptionText = typeof rawDescription === 'string' ? rawDescription.trim() : null;
  const truncatedDescription =
    descriptionText && descriptionText.length > 100
      ? `${descriptionText.substring(0, 100)}...`
      : descriptionText;

  return (
    <div
      className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer relative overflow-hidden"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
      onClick={onClick}
    >
      {/* Component Name */}
      <h4 className="font-medium text-sm mb-1 relative" style={{ color: colors.text }}>
        {data.name || name}
      </h4>

      {/* Component Description */}
      {truncatedDescription && (
        <div
          className={clsx(
            'text-xs mb-2 line-clamp-2',
            isModuleOrTool ? 'text-gray-200' : 'text-gray-600'
          )}
          style={
            isModuleOrTool
              ? undefined
              : {
                  color: colors.text,
                  opacity: 0.8,
                }
          }
        >
          {truncatedDescription}
        </div>
      )}

      {/* Component Metadata */}
      <div className="space-y-1 text-xs relative" style={{ color: colors.text, opacity: 0.9 }}>
        {data.metadata?.language &&
          data.metadata.language !== 'unknown' &&
          data.metadata.language.trim() !== '' && (
            <div>
              <span className="text-gray-400">Language:</span>{' '}
              <span className="font-mono">{data.metadata.language}</span>
            </div>
          )}
        {data.metadata?.framework &&
          data.metadata.framework !== 'unknown' &&
          data.metadata.framework.trim() !== '' && (
            <div>
              <span className="text-gray-400">Framework:</span>{' '}
              <span className="font-mono">{data.metadata.framework}</span>
            </div>
          )}
        {data.version && data.version.trim() !== '' && (
          <div>
            <span className="text-gray-400">Version:</span>{' '}
            <span className="font-mono">{data.version}</span>
          </div>
        )}
        {data.image && data.image.trim() !== '' && (
          <div>
            <span className="text-gray-400">Image:</span>{' '}
            <span className="font-mono">{data.image}</span>
          </div>
        )}
        {data.ports && (
          <div>
            <span className="text-gray-400">Ports:</span>{' '}
            <span className="font-mono">
              {(() => {
                if (Array.isArray(data.ports)) {
                  // Handle array of ports - extract port numbers
                  return data.ports
                    .map((port: any) => {
                      if (typeof port === 'object' && port !== null) {
                        // Extract port number from object
                        return (
                          port.port ||
                          port.targetPort ||
                          port.number ||
                          port.value ||
                          JSON.stringify(port)
                        );
                      }
                      return String(port);
                    })
                    .join(', ');
                } else if (typeof data.ports === 'object' && data.ports !== null) {
                  // Handle port object - extract meaningful values
                  const portObj = data.ports as any;

                  // If it's a single port object with port/targetPort
                  if (portObj.port || portObj.targetPort) {
                    return `${portObj.port || portObj.targetPort}${portObj.targetPort && portObj.port !== portObj.targetPort ? `:${portObj.targetPort}` : ''}`;
                  }

                  // If it's an object with multiple port entries
                  return Object.entries(portObj)
                    .map(([key, value]) => {
                      if (typeof value === 'object' && value !== null) {
                        const port = value as any;
                        return port.port || port.targetPort || port.number || port.value || key;
                      }
                      return value;
                    })
                    .filter(p => p !== null && p !== undefined)
                    .join(', ');
                } else {
                  return String(data.ports);
                }
              })()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
