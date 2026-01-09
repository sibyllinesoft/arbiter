import type { ArtifactCardMetaRow } from "@/components/core/ArtifactCard";
import { layoutReactFlow } from "@/utils/reactFlowLayout";
import { Flag, GitBranch, Layers, User, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React from "react";
import { type Edge, MarkerType, type Node } from "reactflow";
import type { NormalizedTask, NormalizedTaskGroup, TaskFlowData, TaskNodeData } from "./types";
import { getTaskLayerKey, slugify } from "./utils";

export const buildTaskCardData = (task: NormalizedTask) => {
  const layerKey = getTaskLayerKey(task.statusClass);

  return {
    name: task.name,
    type: layerKey,
    metadata: {
      description: task.description ?? undefined,
      summary: task.description ?? undefined,
      category: layerKey,
      group: task.groupName ?? undefined,
      owner: task.assignee ?? undefined,
    },
  };
};

/** Create a meta row with icon and labeled content */
const createMetaRow = (
  key: string,
  Icon: LucideIcon,
  label: string,
  value: string | number,
  extraClass = "",
): ArtifactCardMetaRow => ({
  key,
  icon: React.createElement(Icon),
  content: React.createElement(
    "span",
    { className: `opacity-100 ${extraClass}`.trim() },
    `${label}: ${value}`,
  ),
});

export const buildTaskMetaRows = (task: NormalizedTask): ArtifactCardMetaRow[] => {
  const rows: ArtifactCardMetaRow[] = [];
  const statusLabel = task.status ?? (task.completed ? "Completed" : "Unclassified");

  rows.push(createMetaRow("status", Workflow, "Status", statusLabel, "capitalize"));
  if (task.priority) rows.push(createMetaRow("priority", Flag, "Priority", task.priority));
  if (task.assignee) rows.push(createMetaRow("assignee", User, "Owner", task.assignee));
  if (task.groupName) rows.push(createMetaRow("group", Layers, "Group", task.groupName));
  if (task.dependsOn.length > 0) {
    rows.push(createMetaRow("dependencies", GitBranch, "Dependencies", task.dependsOn.length));
  }

  return rows;
};

export const buildTaskFlowData = (
  group: NormalizedTaskGroup,
  selectedTaskId: string | null,
): TaskFlowData => {
  const nodes: Node<TaskNodeData>[] = [];
  const edges: Edge[] = [];
  const missingDependencies: string[] = [];

  const matchMap = new Map<string, NormalizedTask>();
  group.tasks.forEach((task) => {
    task.matchKeys.forEach((key) => {
      if (key && !matchMap.has(key)) {
        matchMap.set(key, task);
      }
    });
  });

  group.tasks.forEach((task, index) => {
    nodes.push({
      id: task.nodeId,
      type: "task",
      position: { x: 0, y: 0 },
      data: {
        task,
        isSelected: task.nodeId === selectedTaskId,
      },
      draggable: false,
      selectable: true,
      style: { width: 220 },
      selected: task.nodeId === selectedTaskId,
    });
  });

  const edgeIds = new Set<string>();

  group.tasks.forEach((task) => {
    if (!task.dependsOn.length) {
      return;
    }

    task.dependsOn.forEach((dep) => {
      const normalized = slugify(dep);
      const dependencyTask = normalized ? matchMap.get(normalized) : undefined;

      if (dependencyTask) {
        const edgeId = `${dependencyTask.nodeId}->${task.nodeId}`;
        if (!edgeIds.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: dependencyTask.nodeId,
            target: task.nodeId,
            type: "smoothstep",
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
            animated: false,
          });
          edgeIds.add(edgeId);
        }
      } else {
        missingDependencies.push(`${task.name} depends on ${dep}`);
      }
    });
  });

  const { nodes: layoutedNodes } = layoutReactFlow(nodes, edges, {
    layout: "flow",
    defaultSize: { width: 220, height: 140 },
    direction: "LR",
  });

  return {
    nodes: layoutedNodes,
    edges,
    missingDependencies: Array.from(new Set(missingDependencies)),
  };
};
