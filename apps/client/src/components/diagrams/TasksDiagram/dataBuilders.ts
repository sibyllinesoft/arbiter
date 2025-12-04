import type { ArtifactCardMetaRow } from "@/components/ArtifactCard";
import { layoutReactFlow } from "@/utils/reactFlowLayout";
import { Flag, GitBranch, Layers, User, Workflow } from "lucide-react";
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
      epic: task.epicName ?? undefined,
      owner: task.assignee ?? undefined,
    },
  };
};

export const buildTaskMetaRows = (task: NormalizedTask): ArtifactCardMetaRow[] => {
  const rows: ArtifactCardMetaRow[] = [];

  const statusLabel = task.status ? task.status : task.completed ? "Completed" : "Unclassified";

  rows.push({
    key: "status",
    icon: React.createElement(Workflow),
    content: React.createElement(
      "span",
      { className: "opacity-100 capitalize" },
      `Status: ${statusLabel}`,
    ),
  });

  if (task.priority) {
    rows.push({
      key: "priority",
      icon: React.createElement(Flag),
      content: React.createElement(
        "span",
        { className: "opacity-100" },
        `Priority: ${task.priority}`,
      ),
    });
  }

  if (task.assignee) {
    rows.push({
      key: "assignee",
      icon: React.createElement(User),
      content: React.createElement("span", { className: "opacity-100" }, `Owner: ${task.assignee}`),
    });
  }

  if (task.epicName) {
    rows.push({
      key: "epic",
      icon: React.createElement(Layers),
      content: React.createElement("span", { className: "opacity-100" }, `Epic: ${task.epicName}`),
    });
  }

  if (task.dependsOn.length > 0) {
    rows.push({
      key: "dependencies",
      icon: React.createElement(GitBranch),
      content: React.createElement(
        "span",
        { className: "opacity-100" },
        `Dependencies: ${task.dependsOn.length}`,
      ),
    });
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
