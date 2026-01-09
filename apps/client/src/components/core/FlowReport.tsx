/**
 * FlowReport - Standalone flow diagram report component
 */

import React from "react";
import { FlowDiagram } from "../diagrams";

interface FlowReportProps {
  projectId: string;
  className?: string;
}

export function FlowReport({ projectId, className }: FlowReportProps) {
  return (
    <div className={`h-full ${className || ""}`}>
      <FlowDiagram projectId={projectId} />
    </div>
  );
}
