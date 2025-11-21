import { Card } from "@/design-system";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildTaskFlowData } from "../dataBuilders";
import type { NormalizedTask, TaskGroupPanelProps } from "../types";
import { TaskDetailCard } from "./TaskDetailCard";
import { TaskFlow } from "./TaskFlow";

export function TaskGroupPanel({ group, isActive, onTaskClick, onEpicEdit }: TaskGroupPanelProps) {
  const [selectedTask, setSelectedTask] = useState<NormalizedTask | null>(null);
  const flowContainerRef = useRef<HTMLDivElement | null>(null);
  const [hasMeasuredSize, setHasMeasuredSize] = useState(false);
  const [flowSize, setFlowSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>(() => {
    if (typeof window === "undefined") {
      return { width: 1280, height: 720 };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  });

  const flowData = useMemo(
    () => buildTaskFlowData(group, selectedTask?.nodeId ?? null),
    [group, selectedTask?.nodeId],
  );

  useEffect(() => {
    setSelectedTask(null);
    setHasMeasuredSize(false);
  }, [group.id, isActive]);

  const updateMeasuredSize = useCallback(() => {
    if (!isActive) {
      setHasMeasuredSize(false);
      return false;
    }

    const node = flowContainerRef.current;
    if (!node) {
      return false;
    }

    const rect = node.getBoundingClientRect();
    const computed = window.getComputedStyle(node);
    const paddingX =
      parseFloat(computed.paddingLeft || "0") + parseFloat(computed.paddingRight || "0");
    const paddingY =
      parseFloat(computed.paddingTop || "0") + parseFloat(computed.paddingBottom || "0");

    const width = Math.max(1, Math.round(rect.width - paddingX));
    const height = Math.max(1, Math.round(rect.height - paddingY));

    if (width <= 0 || height <= 0) {
      setHasMeasuredSize(false);
      return false;
    }

    setFlowSize((previous) => {
      const deltaWidth = width - previous.width;
      const deltaHeight = height - previous.height;
      const noChange = Math.abs(deltaWidth) < 1 && Math.abs(deltaHeight) < 1;
      return noChange ? previous : { width, height };
    });

    setHasMeasuredSize(true);

    return true;
  }, [isActive, group.id]);

  useEffect(() => {
    const updateViewport = () => {
      if (typeof window === "undefined") return;
      setViewportSize({
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight),
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (updateMeasuredSize()) {
      return;
    }

    let frame: number;
    const measureUntilVisible = () => {
      if (!updateMeasuredSize()) {
        frame = requestAnimationFrame(measureUntilVisible);
      }
    };

    frame = requestAnimationFrame(measureUntilVisible);

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [group.id, updateMeasuredSize, isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const node = flowContainerRef.current;
    if (!node) return;

    const observer = new ResizeObserver(() => {
      updateMeasuredSize();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [updateMeasuredSize, isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleResize = () => {
      updateMeasuredSize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateMeasuredSize, isActive]);

  const hasTasks = group.tasks.length > 0;
  const baseWidth = Math.max(1200, Math.round(viewportSize.width * 0.92));
  const baseHeight = Math.max(720, Math.round(viewportSize.height * 0.85));
  const renderWidth = baseWidth;
  const renderHeight = baseHeight;
  const adjustedHeight = Math.max(520, renderHeight - 20);
  const shouldRenderFlow = isActive && renderWidth > 0 && adjustedHeight > 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Card
        variant="ghost"
        size="sm"
        className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent shadow-none ring-0"
        bodyClassName="flex min-h-0 flex-1 flex-col p-0"
      >
        <div
          ref={flowContainerRef}
          className="flex-1 min-h-0 overflow-hidden"
          style={{ minHeight: `${adjustedHeight}px` }}
        >
          {hasTasks ? (
            shouldRenderFlow ? (
              <div
                className="relative h-full w-full overflow-hidden bg-white dark:bg-graphite-950"
                style={{ minHeight: `${adjustedHeight}px` }}
              >
                {group.type === "epic" && group.description && (
                  <div className="pointer-events-none absolute left-2 top-2 z-[999] flex justify-start">
                    <div
                      className="pointer-events-none rounded-lg border border-white/30 bg-white/50 p-3 text-xs leading-relaxed text-gray-900 shadow-xl backdrop-blur-[10px] dark:border-white/10 dark:bg-graphite-900/50 dark:text-graphite-50"
                      style={{ width: "25%", minWidth: "16rem", maxWidth: "24rem" }}
                    >
                      <p className="whitespace-pre-line">{group.description}</p>
                    </div>
                  </div>
                )}
                <div
                  className="absolute left-1/2 top-1/2 bg-white dark:bg-graphite-950"
                  style={{
                    width: `${renderWidth}px`,
                    height: `${adjustedHeight}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <TaskFlow
                    nodes={flowData.nodes}
                    edges={flowData.edges}
                    onSelectTask={setSelectedTask}
                    width={renderWidth}
                    height={adjustedHeight}
                    onTaskClick={onTaskClick}
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white dark:bg-graphite-950 text-xs text-graphite-400">
                <span>Preparing canvas…</span>
              </div>
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center px-6 text-base font-semibold text-gray-700 text-center dark:text-graphite-100">
              {group.type === "unscoped"
                ? "No unscoped tasks yet. Use Add Task to capture work that has not been assigned to an epic."
                : "No tasks have been added to this epic yet. Use Add Task to start planning the work."}
            </div>
          )}
        </div>

        {(selectedTask || flowData.missingDependencies.length > 0) && (
          <div className="space-y-4 px-6 py-4">
            {selectedTask && <TaskDetailCard task={selectedTask} />}

            {flowData.missingDependencies.length > 0 && (
              <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <p className="font-medium">Unresolved dependencies</p>
                <ul className="mt-1 list-disc list-inside space-y-1 text-xs sm:text-sm">
                  {flowData.missingDependencies.map((dependency, index) => (
                    <li key={`${group.id}-missing-${index}`}>{dependency}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
