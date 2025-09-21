/**
 * FsmReport - Standalone FSM diagram report component
 */

import React from 'react';
import { FsmDiagram } from './diagrams';

interface FsmReportProps {
  projectId: string;
  className?: string;
}

export function FsmReport({ projectId, className }: FsmReportProps) {
  return (
    <div className={`h-full ${className || ''}`}>
      <FsmDiagram projectId={projectId} />
    </div>
  );
}
