/**
 * MetadataBanner - Displays spec metadata (apiVersion, kind, metadata) in a compact banner
 */

import React from 'react';
import { Package, Tag, Info } from 'lucide-react';

interface MetadataBannerProps {
  /** Resolved spec data containing apiVersion, kind, metadata */
  data: Record<string, unknown>;
  /** Additional CSS classes */
  className?: string;
}

export function MetadataBanner({ data, className = '' }: MetadataBannerProps) {
  const apiVersion = data.apiVersion as string;
  const kind = data.kind as string;
  const metadata = data.metadata as Record<string, unknown>;

  // If no metadata fields are present, don't render the banner
  if (!apiVersion && !kind && !metadata) {
    return null;
  }

  return (
    <div className={`bg-blue-50 border-b border-blue-200 px-4 py-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* API Version */}
          {apiVersion && (
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-900">
                <span className="font-medium">API:</span> {apiVersion}
              </span>
            </div>
          )}

          {/* Kind */}
          {kind && (
            <div className="flex items-center space-x-2">
              <Tag className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-900">
                <span className="font-medium">Kind:</span> {kind}
              </span>
            </div>
          )}

          {/* Metadata info */}
          {metadata && Object.keys(metadata).length > 0 && (
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-900">
                <span className="font-medium">Metadata:</span> {Object.keys(metadata).length}{' '}
                properties
              </span>
            </div>
          )}
        </div>

        {/* Metadata properties (condensed) */}
        {metadata && (
          <div className="flex items-center space-x-3">
            {metadata.name && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                {metadata.name}
              </span>
            )}
            {metadata.namespace && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                ns: {metadata.namespace}
              </span>
            )}
            {metadata.version && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                v{metadata.version}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
