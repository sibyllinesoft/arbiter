/**
 * SiteReport - Standalone site diagram report component
 */

import React from 'react';
import { SiteDiagram } from './diagrams';

interface SiteReportProps {
  projectId: string;
  className?: string;
}

export function SiteReport({ projectId, className }: SiteReportProps) {
  return (
    <div className={`h-full ${className || ''}`}>
      <SiteDiagram projectId={projectId} />
    </div>
  );
}
