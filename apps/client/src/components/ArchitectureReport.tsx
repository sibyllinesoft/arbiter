/**
 * ArchitectureReport - Standalone architecture diagram report component
 */

import React from 'react';
import { ArchitectureDiagram } from './diagrams';

interface ArchitectureReportProps {
  projectId: string;
  className?: string;
}

export function ArchitectureReport({ projectId, className }: ArchitectureReportProps) {
  return (
    <div className={`h-full ${className || ''}`}>
      <ArchitectureDiagram projectId={projectId} />
    </div>
  );
}
