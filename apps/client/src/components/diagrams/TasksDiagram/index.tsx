/**
 * Tasks diagram component for managing project groups and tasks.
 * Displays tabbed views of task groups with create/edit modals.
 */
import LayoutTabs from "@/components/Layout/Tabs";
import AddEntityModal from "@/components/modals/AddEntityModal";
import type { FieldValue } from "@/components/modals/entityTypes";
import { useTabBadgeUpdater } from "@/contexts/TabBadgeContext";
import type { TabItem as LayoutTabItem } from "@/types/ui";
import { AlertCircle } from "lucide-react";
import React, { forwardRef, useEffect, useImperativeHandle, useMemo } from "react";
import "reactflow/dist/style.css";
import { TaskGroupPanel } from "./components/TaskGroupPanel";
import {
  useGroupLookup,
  useGroupModal,
  useGroupSubmitHandler,
  useModalText,
  useResolvedSpec,
  useTaskGroups,
  useTaskModal,
  useTaskSubmitHandler,
  useUiOptionCatalog,
} from "./hooks";
import type {
  NormalizedTaskGroup,
  TaskGroupPanelProps,
  TasksDiagramHandle,
  TasksDiagramProps,
} from "./types";
import { slugify } from "./utils";

/** Hook for tab badge management */
function useTasksBadge(
  projectId: string | undefined,
  taskGroups: NormalizedTaskGroup[],
  tasksReady: boolean,
) {
  const tabBadgeUpdater = useTabBadgeUpdater();
  const totalTasks = useMemo(
    () => (tasksReady ? taskGroups.reduce((sum, group) => sum + group.tasks.length, 0) : null),
    [taskGroups, tasksReady],
  );

  useEffect(() => {
    if (!projectId || totalTasks == null) {
      tabBadgeUpdater("tasks", null);
      return () => tabBadgeUpdater("tasks", null);
    }
    tabBadgeUpdater("tasks", totalTasks);
    return () => tabBadgeUpdater("tasks", null);
  }, [projectId, tabBadgeUpdater, totalTasks]);

  return totalTasks;
}

/** Hook for active tab management */
function useActiveTab(taskGroups: NormalizedTaskGroup[]) {
  const [activeTab, setActiveTab] = React.useState("unscoped");

  useEffect(() => {
    if (!taskGroups.length) {
      if (activeTab !== "unscoped") setActiveTab("unscoped");
      return;
    }
    if (!taskGroups.some((group) => group.id === activeTab)) {
      setActiveTab(taskGroups[0]?.id ?? "unscoped");
    }
  }, [taskGroups, activeTab]);

  return { activeTab, setActiveTab };
}

/**
 * Tasks diagram component with group and task management.
 * Provides tabbed navigation, badge counts, and modal-based editing.
 */
export const TasksDiagram = forwardRef<TasksDiagramHandle, TasksDiagramProps>(
  ({ projectId, className = "" }, ref) => {
    const { resolved, error, loadResolved, clearError, isMountedRef } = useResolvedSpec(projectId);
    const taskGroups = useTaskGroups(resolved);
    const { optionCatalog } = useUiOptionCatalog(taskGroups);
    const groupLookup = useGroupLookup(taskGroups);

    const groupModal = useGroupModal();
    const taskModal = useTaskModal();
    const { activeTab, setActiveTab } = useActiveTab(taskGroups);

    const tasksReady = Boolean(resolved);
    useTasksBadge(projectId, taskGroups, tasksReady);

    const handleGroupSubmit = useGroupSubmitHandler(
      projectId,
      loadResolved,
      isMountedRef,
      clearError,
      groupModal.state,
    );

    const handleTaskSubmit = useTaskSubmitHandler(
      projectId,
      loadResolved,
      isMountedRef,
      clearError,
      taskModal.state,
      groupLookup,
    );

    const activeGroup = useMemo(
      () => taskGroups.find((group) => group.id === activeTab) ?? taskGroups[0] ?? null,
      [taskGroups, activeTab],
    );

    useImperativeHandle(
      ref,
      () => ({
        openTaskCreator: () => taskModal.open(activeGroup),
        openGroupCreator: () => groupModal.open(),
      }),
      [activeGroup, taskModal.open, groupModal.open],
    );

    const presetGroup = useMemo(() => {
      if (!taskModal.state.open || !taskModal.state.presetGroupId) return null;
      return (
        groupLookup.get(taskModal.state.presetGroupId) ??
        groupLookup.get(slugify(taskModal.state.presetGroupId)) ??
        null
      );
    }, [taskModal.state, groupLookup]);

    const { title: taskModalTitle, description: taskModalDescription } = useModalText(
      taskModal.state,
      "task",
    );
    const { title: groupModalTitle, description: groupModalDescription } = useModalText(
      groupModal.state,
      "group",
    );

    const groupModalInitialValues = useMemo<Record<string, FieldValue>>(
      () => groupModal.state.initialValues ?? { name: "", description: "" },
      [groupModal.state.initialValues],
    );

    const taskModalInitialValues = useMemo<Record<string, FieldValue>>(() => {
      if (taskModal.state.initialValues) return taskModal.state.initialValues;
      if (presetGroup) return { groupId: presetGroup.rawId ?? presetGroup.id };
      if (taskModal.state.presetGroupId) return { groupId: taskModal.state.presetGroupId };
      return { groupId: "" };
    }, [taskModal.state.initialValues, presetGroup, taskModal.state.presetGroupId]);

    const tabItems = useMemo<LayoutTabItem[]>(
      () =>
        taskGroups.map((group) => {
          const panelProps: TaskGroupPanelProps = {
            group,
            isActive: activeTab === group.id,
            onTaskClick: taskModal.openForEdit,
            ...(group.type === "group" ? { onGroupEdit: groupModal.open } : {}),
          } as TaskGroupPanelProps;

          return {
            id: group.id,
            label: group.type === "unscoped" ? "Unscoped" : group.name,
            badge: String(group.tasks.length),
            content: (
              <div className="h-full px-6 py-6">
                <TaskGroupPanel {...panelProps} />
              </div>
            ),
          } satisfies LayoutTabItem;
        }),
      [taskGroups, activeTab, taskModal.openForEdit, groupModal.open],
    );

    if (!projectId) {
      return (
        <div className={`flex items-center justify-center h-full ${className}`}>
          <p className="text-gray-600">Select a project to view tasks.</p>
        </div>
      );
    }

    return (
      <div className={`flex h-full flex-col bg-white dark:bg-graphite-950 ${className}`}>
        <div className="flex-1 min-h-0 overflow-hidden">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-1 h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="font-medium">Unable to load tasks</p>
                  <p className="text-xs text-red-600 dark:text-red-200/90">{error}</p>
                </div>
              </div>
            </div>
          )}

          <LayoutTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={tabItems}
            className="flex h-full min-h-0 flex-col"
          />
        </div>

        {groupModal.state.open && (
          <AddEntityModal
            open={groupModal.state.open}
            entityType="group"
            groupLabel="Groups"
            optionCatalog={optionCatalog}
            onClose={groupModal.close}
            onSubmit={handleGroupSubmit}
            initialValues={groupModalInitialValues}
            titleOverride={groupModalTitle}
            descriptionOverride={groupModalDescription}
            mode={groupModal.state.mode}
          />
        )}

        {taskModal.state.open && (
          <AddEntityModal
            open={taskModal.state.open}
            entityType="task"
            groupLabel={presetGroup ? `Task for ${presetGroup.name}` : "Task"}
            optionCatalog={optionCatalog}
            onClose={taskModal.close}
            onSubmit={handleTaskSubmit}
            initialValues={taskModalInitialValues}
            titleOverride={taskModalTitle}
            descriptionOverride={taskModalDescription}
            mode={taskModal.state.mode}
          />
        )}
      </div>
    );
  },
);

TasksDiagram.displayName = "TasksDiagram";

export type { TasksDiagramHandle, TasksDiagramProps };
export default TasksDiagram;
