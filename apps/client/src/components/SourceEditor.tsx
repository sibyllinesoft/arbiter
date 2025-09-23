/**
 * SourceEditor - Standalone source code editor component
 */

import React from 'react';
import { SourceDiagram } from './diagrams';

interface SourceEditorProps {
  projectId: string;
  className?: string;
}

export function SourceEditor({ projectId, className }: SourceEditorProps) {
  return (
    <div className={`h-full ${className || ''}`}>
      <SourceDiagram projectId={projectId} />
    </div>
  );
}
