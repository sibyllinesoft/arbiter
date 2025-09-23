/**
 * FriendlyEditor - Standalone friendly diagram editor component with metadata banner
 */

import React, { useState } from 'react';
import { MetadataBanner } from './MetadataBanner';
import { FriendlyDiagram } from './diagrams';

interface FriendlyEditorProps {
  projectId: string;
  className?: string;
}

export function FriendlyEditor({ projectId, className }: FriendlyEditorProps) {
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null);

  const handleDataLoaded = (data: Record<string, unknown>) => {
    setMetadata(data);
  };

  return (
    <div className={`h-full flex flex-col ${className || ''}`}>
      {/* Metadata Banner */}
      {metadata && <MetadataBanner data={metadata} className="flex-shrink-0" />}

      {/* Friendly Diagram */}
      <div className="flex-1 min-h-0">
        <FriendlyDiagram projectId={projectId} onDataLoaded={handleDataLoaded} />
      </div>
    </div>
  );
}
