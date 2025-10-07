/**
 * TasksReport - Standalone tasks diagram report component
 */

import React from "react";
import { TasksDiagram } from "./diagrams";

interface TasksReportProps {
  projectId: string;
  className?: string;
}

export function TasksReport({ projectId, className }: TasksReportProps) {
  return (
    <div className={`h-full ${className || ""}`}>
      <TasksDiagram projectId={projectId} />
    </div>
  );
}
