import React, { useCallback, useEffect, useRef } from "react";
import ReactFlow, { getRectOfNodes, type ReactFlowInstance } from "reactflow";
import { BOTTOM_PADDING, HORIZONTAL_PADDING, MAX_ZOOM, MIN_ZOOM, TOP_PADDING } from "../constants";
import type { TaskFlowProps, TaskNodeData } from "../types";
import { TASK_NODE_TYPES } from "./TaskNode";

export function TaskFlow({
  nodes,
  edges,
  onSelectTask,
  width,
  height,
  onTaskClick,
}: TaskFlowProps) {
  const instanceRef = useRef<ReactFlowInstance | null>(null);

  const applyViewport = useCallback(() => {
    const instance = instanceRef.current;
    if (!instance || nodes.length === 0 || width <= 0 || height <= 0) {
      return;
    }

    const rect = getRectOfNodes(nodes);
    if (!rect) {
      return;
    }

    const paddedWidth = Math.max(rect.width + HORIZONTAL_PADDING * 2, 1);
    const paddedHeight = Math.max(rect.height + TOP_PADDING + BOTTOM_PADDING, 1);

    const zoomX = width / paddedWidth;
    const zoomY = height / paddedHeight;
    const targetZoom = Math.min(Math.max(Math.min(zoomX, zoomY), MIN_ZOOM), MAX_ZOOM);

    const x = (HORIZONTAL_PADDING - rect.x) * targetZoom;
    const y = (TOP_PADDING - rect.y) * targetZoom;

    instance.setViewport({ x, y, zoom: targetZoom });
  }, [nodes, width, height]);

  useEffect(() => {
    applyViewport();
  }, [applyViewport, edges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={TASK_NODE_TYPES}
      proOptions={{ hideAttribution: true }}
      className="bg-transparent"
      style={{ width, height }}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.35}
      maxZoom={1.6}
      panOnScroll={false}
      zoomOnScroll
      zoomOnPinch
      onInit={(instance) => {
        instanceRef.current = instance;
        applyViewport();
      }}
      onNodeClick={(_, node) => {
        const data = node.data as TaskNodeData;
        onSelectTask(data.task);
        onTaskClick(data.task);
      }}
      onPaneClick={() => onSelectTask(null)}
    />
  );
}
