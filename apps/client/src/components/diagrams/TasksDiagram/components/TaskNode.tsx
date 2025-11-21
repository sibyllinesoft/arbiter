import { ArtifactCard } from "@/components/ArtifactCard";
import { clsx } from "clsx";
import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";
import { buildTaskCardData, buildTaskMetaRows } from "../dataBuilders";
import type { TaskNodeData } from "../types";

export const TaskNode: React.FC<NodeProps<TaskNodeData>> = ({ data }) => {
  const { task, isSelected } = data;
  const cardData = buildTaskCardData(task);
  const metaRows = buildTaskMetaRows(task);

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      <ArtifactCard
        name={task.name}
        data={cardData}
        description={task.description ?? null}
        metaRows={metaRows}
        onClick={() => {}}
        className={clsx(
          isSelected ? "ring-2 ring-offset-2 ring-offset-black/20 ring-white/80" : "",
        )}
      />
    </div>
  );
};

export const TASK_NODE_TYPES = { task: TaskNode };
