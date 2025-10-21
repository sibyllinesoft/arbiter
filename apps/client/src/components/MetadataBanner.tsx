/**
 * MetadataBanner - Displays spec metadata (apiVersion, kind, metadata) in a compact banner
 */

import { Info, Package, Tag } from "lucide-react";
import React from "react";

interface MetadataBannerProps {
  /** Resolved spec data containing apiVersion, kind, metadata */
  data: Record<string, unknown>;
  /** Additional CSS classes */
  className?: string;
}

export function MetadataBanner({ data, className = "" }: MetadataBannerProps) {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  const apiVersion = typeof data.apiVersion === "string" ? data.apiVersion : undefined;
  const kind = typeof data.kind === "string" ? data.kind : undefined;
  const metadata = isRecord(data.metadata) ? data.metadata : undefined;
  const metadataKeys = metadata ? Object.keys(metadata) : [];
  const metadataName = metadata && typeof metadata.name === "string" ? metadata.name : undefined;
  const metadataNamespace =
    metadata && typeof metadata.namespace === "string" ? metadata.namespace : undefined;
  const metadataVersion =
    metadata && typeof metadata.version === "string" ? metadata.version : undefined;

  // If no metadata fields are present, don't render the banner
  if (!apiVersion && !kind && (!metadata || metadataKeys.length === 0)) {
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
          {metadata && metadataKeys.length > 0 && (
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-900">
                <span className="font-medium">Metadata:</span> {metadataKeys.length} properties
              </span>
            </div>
          )}
        </div>

        {/* Metadata properties (condensed) */}
        {metadata && (
          <div className="flex items-center space-x-3">
            {metadataName && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                {metadataName}
              </span>
            )}
            {metadataNamespace && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                ns: {metadataNamespace}
              </span>
            )}
            {metadataVersion && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                v{metadataVersion}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
