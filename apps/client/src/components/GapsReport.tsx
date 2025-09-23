/**
 * GapsReport - Standalone gaps checklist report component
 */

import React from 'react';
import { GapsChecklist } from './diagrams';

interface GapsReportProps {
  projectId: string;
  className?: string;
}

export function GapsReport({ projectId, className }: GapsReportProps) {
  return (
    <div className={`h-full ${className || ''}`}>
      <GapsChecklist projectId={projectId} />
    </div>
  );
}
