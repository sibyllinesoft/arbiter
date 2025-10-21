/**
 * ViewReport - Standalone view diagram report component
 */

import React from "react";
import { ViewDiagram } from "./diagrams";

interface ViewReportProps {
  projectId: string;
  className?: string;
}

export function ViewReport({ projectId, className }: ViewReportProps) {
  return (
    <div className={`h-full ${className || ""}`}>
      <ViewDiagram projectId={projectId} />
    </div>
  );
}
