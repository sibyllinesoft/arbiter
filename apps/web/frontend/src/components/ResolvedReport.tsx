/**
 * ResolvedReport - Standalone resolved viewer report component
 */

import React from 'react';
import { ResolvedViewer } from './diagrams';

interface ResolvedReportProps {
  projectId: string;
  className?: string;
}

export function ResolvedReport({ projectId, className }: ResolvedReportProps) {
  return (
    <div className={`h-full ${className || ''}`}>
      <ResolvedViewer projectId={projectId} />
    </div>
  );
}
