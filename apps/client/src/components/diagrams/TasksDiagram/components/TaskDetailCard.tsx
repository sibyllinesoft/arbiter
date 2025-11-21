import { ArtifactCard } from "@/components/ArtifactCard";
import React from "react";
import { buildTaskCardData, buildTaskMetaRows } from "../dataBuilders";
import type { TaskDetailCardProps } from "../types";

export const TaskDetailCard: React.FC<TaskDetailCardProps> = ({ task }) => {
  const cardData = buildTaskCardData(task);
  const metaRows = buildTaskMetaRows(task);
  const hasDependencies = task.dependsOn.length > 0;

  return (
    <div className="space-y-3">
      <ArtifactCard
        name={task.name}
        data={cardData}
        description={task.description ?? null}
        metaRows={metaRows}
        onClick={() => {}}
      />

      {hasDependencies && (
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700 shadow-sm dark:bg-white/10 dark:text-white/85">
          <p className="font-medium text-slate-900 dark:text-white">Dependencies</p>
          <ul className="mt-2 list-disc list-inside space-y-1">
            {task.dependsOn.map((dep) => (
              <li key={`${task.nodeId}-${dep}`}>{dep}</li>
            ))}
          </ul>
        </div>
      )}

      {!task.description && !hasDependencies && (
        <p className="text-xs text-slate-500 dark:text-white/70">
          No additional details provided for this task yet.
        </p>
      )}
    </div>
  );
};
