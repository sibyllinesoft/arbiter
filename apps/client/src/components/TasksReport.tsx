/**
 * TasksReport - Standalone tasks diagram report component
 */

import clsx from "clsx";
import { Eye } from "lucide-react";
import React from "react";
import { TasksDiagram } from "./diagrams";

interface TasksReportProps {
  projectId: string;
  className?: string;
}

export function TasksReport({ projectId, className }: TasksReportProps) {
  return (
    <div className={clsx("h-full flex flex-col bg-gray-50 dark:bg-graphite-950", className)}>
      <div className="border-b border-graphite-200/60 bg-gray-100 px-6 py-6 dark:border-graphite-700/60 dark:bg-graphite-900/70">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center text-amber-600 dark:text-amber-200">
            <Eye className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25">
              Tasks & Epics
            </h2>
            <p className="text-sm text-gray-600 dark:text-graphite-300">
              Inspect task breakdowns across epics and update ownership as work progresses.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 py-6">
        <TasksDiagram projectId={projectId} />
      </div>
    </div>
  );
}
