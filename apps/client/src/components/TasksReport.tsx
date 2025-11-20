/**
 * TasksReport - Standalone tasks diagram report component
 */

import { Button } from "@/design-system";
import clsx from "clsx";
import { Eye, Plus } from "lucide-react";
import React, { useRef } from "react";
import { TasksDiagram, type TasksDiagramHandle } from "./diagrams";

interface TasksReportProps {
  projectId: string;
  className?: string;
}

export function TasksReport({ projectId, className }: TasksReportProps) {
  const diagramRef = useRef<TasksDiagramHandle>(null);

  return (
    <div className={clsx("h-full flex flex-col bg-gray-50 dark:bg-graphite-950", className)}>
      <div className="border-b border-graphite-200/60 bg-gray-100 px-6 py-4 dark:border-graphite-700/60 dark:bg-graphite-900/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center text-amber-600 dark:text-amber-200">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25">
                Tasks & Epics
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              className="gap-2"
              onClick={() => diagramRef.current?.openTaskCreator()}
            >
              Add Task
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Plus className="h-4 w-4" />}
              className="gap-2"
              onClick={() => diagramRef.current?.openEpicCreator()}
            >
              Add Epic
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <TasksDiagram ref={diagramRef} projectId={projectId} />
      </div>
    </div>
  );
}
