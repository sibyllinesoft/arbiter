import { clsx } from 'clsx';
import React from 'react';
import { LAYER_COLORS } from '../constants';

interface ComponentCardProps {
  name: string;
  data: any;
  onClick: () => void;
}

export const ComponentCard: React.FC<ComponentCardProps> = ({ name, data, onClick }) => {
  // Standardize component types
  let componentType =
    data.type || data.metadata?.type || (name.includes('@') ? 'module' : 'service');

  // Standardize binary to tool
  if (componentType === 'binary') {
    componentType = 'tool';
  }
  if (componentType === 'library') {
    componentType = 'module';
  }

  const colors: (typeof LAYER_COLORS)[keyof typeof LAYER_COLORS] =
    componentType === 'service'
      ? LAYER_COLORS.service
      : componentType === 'frontend'
        ? LAYER_COLORS.frontend
        : componentType === 'tool'
          ? LAYER_COLORS.tool
          : componentType === 'module'
            ? LAYER_COLORS.module
            : componentType === 'database'
              ? LAYER_COLORS.data
              : LAYER_COLORS.external;
  console.log(data);

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
      {(data.description || data.metadata?.description) && (
        <div
          className="text-xs text-gray-600 mb-2 line-clamp-2"
          style={{ color: colors.text, opacity: 0.8 }}
        >
          {(data.description || data.metadata?.description || '').length > 100
            ? `${(data.description || data.metadata?.description).substring(0, 100)}...`
            : data.description || data.metadata?.description}
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
