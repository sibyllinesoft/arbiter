import LayoutTabs from "@/components/Layout/Tabs";
import AddEntityModal from "@/components/modals/AddEntityModal";
import { coerceFieldValueToString } from "@/components/modals/AddEntityModal";
import {
  DEFAULT_UI_OPTION_CATALOG,
  type EpicTaskOption,
  type FieldValue,
  type TaskEpicOption,
  type UiOptionCatalog,
} from "@/components/modals/entityTypes";
import { useTabBadgeUpdater } from "@/contexts/TabBadgeContext";
import { apiService } from "@/services/api";
import type { TabItem as LayoutTabItem } from "@/types/ui";
import { AlertCircle } from "lucide-react";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import "reactflow/dist/style.css";
import { TaskGroupPanel } from "./components/TaskGroupPanel";
import { buildTaskGroups } from "./normalizers";
import type {
  NormalizedTask,
  NormalizedTaskGroup,
  ResolvedSpec,
  TaskGroupPanelProps,
  TasksDiagramHandle,
  TasksDiagramProps,
} from "./types";
import { slugify } from "./utils";

export const TasksDiagram = forwardRef<TasksDiagramHandle, TasksDiagramProps>(
  ({ projectId, className = "" }, ref) => {
    const [resolved, setResolved] = useState<ResolvedSpec | null>(null);
    const [, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uiOptionCatalog, setUiOptionCatalog] =
      useState<UiOptionCatalog>(DEFAULT_UI_OPTION_CATALOG);
    const [epicModalState, setEpicModalState] = useState<{
      open: boolean;
      initialValues: Record<string, FieldValue> | null;
      mode: "create" | "edit";
      targetArtifactId: string | null;
      draftIdentifier: string | null;
    }>({
      open: false,
      initialValues: null,
      mode: "create",
      targetArtifactId: null,
      draftIdentifier: null,
    });
    const { targetArtifactId: activeEpicArtifactId, draftIdentifier: activeEpicDraftIdentifier } =
      epicModalState;
    const [taskModalState, setTaskModalState] = useState<{
      open: boolean;
      presetEpicId: string | null;
      initialValues: Record<string, FieldValue> | null;
      mode: "create" | "edit";
      targetArtifactId: string | null;
    }>({
      open: false,
      presetEpicId: null,
      initialValues: null,
      mode: "create",
      targetArtifactId: null,
    });
    const [activeTab, setActiveTab] = useState<string>("unscoped");
    const isMountedRef = useRef(true);

    useEffect(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
      };
    }, []);

    const loadResolved = useCallback(
      async (options: { silent?: boolean } = {}) => {
        if (!isMountedRef.current) return;

        const { silent = false } = options;

        if (!projectId) {
          setResolved(null);
          setLoading(false);
          return;
        }

        try {
          if (!silent) {
            setLoading(true);
          }
          setError(null);
          const response = await apiService.getResolvedSpec(projectId);
          if (!isMountedRef.current) return;
          setResolved(response.resolved as ResolvedSpec);
        } catch (err) {
          console.error("Failed to load epic/task data", err);
          if (!isMountedRef.current) return;
          setResolved(null);
          setError(err instanceof Error ? err.message : "Failed to load tasks");
          throw err;
        } finally {
          if (!silent && isMountedRef.current) {
            setLoading(false);
          }
        }
      },
      [projectId],
    );

    useEffect(() => {
      loadResolved().catch(() => {
        /* handled in loadResolved */
      });
    }, [loadResolved]);

    useEffect(() => {
      let active = true;
      (async () => {
        try {
          const options = await apiService.getUiOptionCatalog();
          if (!active || !isMountedRef.current || !options) return;
          setUiOptionCatalog((prev) => ({
            ...DEFAULT_UI_OPTION_CATALOG,
            ...prev,
            ...options,
          }));
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn("[TasksDiagram] failed to fetch UI option catalog", err);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, []);

    const taskGroups = useMemo(() => buildTaskGroups(resolved), [resolved]);
    const tabBadgeUpdater = useTabBadgeUpdater();
    const tasksReady = Boolean(resolved);
    const totalTasks = useMemo(
      () => (tasksReady ? taskGroups.reduce((sum, group) => sum + group.tasks.length, 0) : null),
      [taskGroups, tasksReady],
    );

    useEffect(() => {
      if (!projectId) {
        tabBadgeUpdater("tasks", null);
        return () => {
          tabBadgeUpdater("tasks", null);
        };
      }
      if (totalTasks == null) {
        tabBadgeUpdater("tasks", null);
        return () => {
          tabBadgeUpdater("tasks", null);
        };
      }
      tabBadgeUpdater("tasks", totalTasks);
      return () => {
        tabBadgeUpdater("tasks", null);
      };
    }, [projectId, tabBadgeUpdater, totalTasks]);

    useEffect(() => {
      if (!taskGroups.length) {
        if (activeTab !== "unscoped") {
          setActiveTab("unscoped");
        }
        return;
      }

      if (!taskGroups.some((group) => group.id === activeTab)) {
        setActiveTab(taskGroups[0]?.id ?? "unscoped");
      }
    }, [taskGroups, activeTab]);

    const { openTaskOptions, epicSelectionOptions } = useMemo(() => {
      const options: EpicTaskOption[] = [];
      const selection: TaskEpicOption[] = [];
      const seenTasks = new Set<string>();
      const seenEpics = new Set<string>();

      taskGroups.forEach((group) => {
        if (group.type === "epic") {
          const epicIdentifier = group.rawId ?? group.id;
          if (epicIdentifier && !seenEpics.has(epicIdentifier)) {
            selection.push({ id: epicIdentifier, name: group.name });
            seenEpics.add(epicIdentifier);
            seenEpics.add(group.id);
          }
        }

        group.tasks.forEach((task) => {
          if (task.completed) {
            return;
          }

          const optionId = String(task.rawId || task.slug || `${group.id}-${task.nodeId}`);
          const dedupeKey = `${group.id}-${optionId}`;
          if (seenTasks.has(dedupeKey)) {
            return;
          }

          seenTasks.add(dedupeKey);

          const option: EpicTaskOption = {
            id: optionId,
            name: task.name,
          };

          if (group.type === "epic") {
            const epicIdentifier = group.rawId ?? group.id;
            option.epicId = epicIdentifier;
            option.epicName = group.name;

            if (epicIdentifier && !seenEpics.has(epicIdentifier)) {
              selection.push({ id: epicIdentifier, name: group.name });
              seenEpics.add(epicIdentifier);
              seenEpics.add(group.id);
            }
          }

          if (task.epicId && !option.epicId) {
            option.epicId = task.epicId;
          }

          if (task.epicName && !option.epicName) {
            option.epicName = task.epicName;
          }

          if (task.status) {
            option.status = task.status;
          }

          options.push(option);
        });
      });

      selection.sort((a, b) => a.name.localeCompare(b.name));

      return { openTaskOptions: options, epicSelectionOptions: selection };
    }, [taskGroups]);

    const optionCatalog = useMemo<UiOptionCatalog>(
      () => ({
        ...uiOptionCatalog,
        epicTaskOptions: openTaskOptions,
        taskEpicOptions: epicSelectionOptions,
      }),
      [uiOptionCatalog, openTaskOptions, epicSelectionOptions],
    );

    const handleCreateEntity = useCallback(
      async ({
        entityType,
        values,
        artifactId,
      }: {
        entityType: string;
        values: Record<string, FieldValue>;
        artifactId?: string | null;
      }) => {
        if (!projectId) {
          return;
        }
        try {
          if (artifactId) {
            await apiService.updateProjectEntity(projectId, artifactId, {
              type: entityType,
              values,
            });
          } else {
            await apiService.createProjectEntity(projectId, {
              type: entityType,
              values,
            });
          }
          await loadResolved({ silent: true });
          if (isMountedRef.current) {
            setError(null);
          }
        } catch (err) {
          console.error("[TasksDiagram] failed to create entity", err);
          if (isMountedRef.current) {
            setError(err instanceof Error ? err.message : "Failed to create entity");
          }
        }
      },
      [projectId, loadResolved],
    );

    const handleEpicSubmit = useCallback(
      (payload: { entityType: string; values: Record<string, FieldValue> }) => {
        const valuesWithContext: Record<string, FieldValue> = { ...payload.values };
        const incomingId =
          typeof valuesWithContext.id === "string" ? valuesWithContext.id.trim() : "";
        const incomingSlug =
          typeof valuesWithContext.slug === "string" ? valuesWithContext.slug.trim() : "";
        const resolvedIdentifier = incomingId || incomingSlug || activeEpicDraftIdentifier || "";

        if (resolvedIdentifier) {
          valuesWithContext.id = resolvedIdentifier;
          valuesWithContext.slug = resolvedIdentifier;
        }

        return handleCreateEntity({
          entityType: payload.entityType,
          values: valuesWithContext,
          artifactId: activeEpicArtifactId ?? null,
        });
      },
      [handleCreateEntity, activeEpicArtifactId, activeEpicDraftIdentifier],
    );

    const epicLookup = useMemo(() => {
      const map = new Map<string, NormalizedTaskGroup>();
      taskGroups.forEach((group) => {
        if (group.type !== "epic") return;
        const identifiers = [group.id, group.rawId ?? "", group.artifactId ?? ""];
        identifiers.filter(Boolean).forEach((identifier) => {
          map.set(identifier, group);
          map.set(slugify(identifier), group);
        });
      });
      return map;
    }, [taskGroups]);

    const handleTaskSubmit = useCallback(
      (payload: { entityType: string; values: Record<string, FieldValue> }) => {
        const valuesWithContext: Record<string, FieldValue> = { ...payload.values };

        const coerceSingle = (value: FieldValue | undefined): string =>
          coerceFieldValueToString(value).trim();

        const rawEpicValue =
          coerceSingle(valuesWithContext.epicId) ||
          coerceSingle(valuesWithContext.epic) ||
          (typeof taskModalState.presetEpicId === "string" ? taskModalState.presetEpicId : "");

        delete valuesWithContext.epic;
        delete valuesWithContext.epicId;
        delete valuesWithContext.epicName;

        const trimmedEpicId = rawEpicValue.trim();

        if (trimmedEpicId.length > 0) {
          const resolvedEpic =
            epicLookup.get(trimmedEpicId) ?? epicLookup.get(slugify(trimmedEpicId));
          const finalEpicId = resolvedEpic
            ? (resolvedEpic.rawId ?? resolvedEpic.id)
            : trimmedEpicId;
          const finalEpicName = resolvedEpic?.name ?? trimmedEpicId;

          valuesWithContext.epicId = finalEpicId;
          valuesWithContext.epic = finalEpicId;
          valuesWithContext.epicName = finalEpicName;
        }

        const targetId = taskModalState.targetArtifactId;
        if (targetId) {
          valuesWithContext.id = targetId;
        }

        return handleCreateEntity({
          entityType: payload.entityType,
          values: valuesWithContext,
          artifactId: targetId,
        });
      },
      [
        taskModalState.presetEpicId,
        taskModalState.targetArtifactId,
        epicLookup,
        handleCreateEntity,
      ],
    );

    const openTaskModal = useCallback((group?: NormalizedTaskGroup | null) => {
      if (group && group.type === "epic") {
        const epicIdentifier = group.rawId ?? group.id;
        setTaskModalState({
          open: true,
          presetEpicId: epicIdentifier,
          initialValues: { epicId: epicIdentifier },
          mode: "create",
          targetArtifactId: null,
        });
      } else {
        setTaskModalState({
          open: true,
          presetEpicId: null,
          initialValues: { epicId: "" },
          mode: "create",
          targetArtifactId: null,
        });
      }
      setError(null);
    }, []);

    const closeTaskModal = useCallback(() => {
      setTaskModalState({
        open: false,
        presetEpicId: null,
        initialValues: null,
        mode: "create",
        targetArtifactId: null,
      });
      setError(null);
    }, []);

    const handleExistingTaskClick = useCallback((task: NormalizedTask) => {
      const initialValues: Record<string, FieldValue> = {
        name: task.name ?? task.rawId ?? "",
        epicId: task.epicId ?? "",
      };
      if (task.description) {
        initialValues.description = task.description;
      }

      setTaskModalState({
        open: true,
        presetEpicId: task.epicId ?? null,
        initialValues,
        mode: "edit",
        targetArtifactId: task.artifactId ?? null,
      });
      setError(null);
    }, []);

    const handleEpicCreate = useCallback(() => {
      setEpicModalState({
        open: true,
        initialValues: { name: "", description: "" },
        mode: "create",
        targetArtifactId: null,
        draftIdentifier: null,
      });
      setError(null);
    }, []);

    const handleEpicEdit = useCallback((group: NormalizedTaskGroup) => {
      if (group.type !== "epic") return;

      const initialValues: Record<string, FieldValue> = {
        name: group.name,
        description: group.description ?? "",
      };

      setEpicModalState({
        open: true,
        initialValues,
        mode: "edit",
        targetArtifactId: group.artifactId ?? null,
        draftIdentifier: group.rawId ?? group.id ?? null,
      });
      setError(null);
    }, []);

    const closeEpicModal = useCallback(() => {
      setEpicModalState({
        open: false,
        initialValues: null,
        mode: "create",
        targetArtifactId: null,
        draftIdentifier: null,
      });
      setError(null);
    }, []);

    const activeGroup = useMemo(
      () => taskGroups.find((group) => group.id === activeTab) ?? taskGroups[0] ?? null,
      [taskGroups, activeTab],
    );

    useImperativeHandle(
      ref,
      () => ({
        openTaskCreator: () => openTaskModal(activeGroup),
        openEpicCreator: handleEpicCreate,
      }),
      [activeGroup, openTaskModal, handleEpicCreate],
    );

    const presetEpicGroup = useMemo(() => {
      if (!taskModalState.open || !taskModalState.presetEpicId) {
        return null;
      }
      return (
        epicLookup.get(taskModalState.presetEpicId) ??
        epicLookup.get(slugify(taskModalState.presetEpicId)) ??
        null
      );
    }, [taskModalState, epicLookup]);

    const taskModalTitle = useMemo(() => {
      if (taskModalState.mode === "edit") {
        const taskName = coerceFieldValueToString(taskModalState.initialValues?.name).trim();
        return taskName.length > 0 ? `Update Task: ${taskName}` : "Update Task";
      }
      return "Add Task";
    }, [taskModalState.mode, taskModalState.initialValues]);

    const taskModalDescription = useMemo(() => {
      return taskModalState.mode === "edit"
        ? "Review and update the selected task. Changes will be saved to the project."
        : "Provide the details needed to add a new task.";
    }, [taskModalState.mode]);

    const epicModalInitialValues = useMemo<Record<string, FieldValue>>(
      () => epicModalState.initialValues ?? { name: "", description: "" },
      [epicModalState.initialValues],
    );

    const epicModalTitle = useMemo(() => {
      if (epicModalState.mode === "edit") {
        const epicName = coerceFieldValueToString(epicModalState.initialValues?.name).trim();
        return epicName.length > 0 ? `Update Epic: ${epicName}` : "Update Epic";
      }
      return "Add Epic";
    }, [epicModalState.mode, epicModalState.initialValues]);

    const epicModalDescription = useMemo(() => {
      return epicModalState.mode === "edit"
        ? "Modify the epic details and save your updates."
        : "Provide the details needed to add a new epic.";
    }, [epicModalState.mode]);

    const taskModalInitialValues = useMemo<Record<string, FieldValue>>(() => {
      if (taskModalState.initialValues) {
        return taskModalState.initialValues;
      }

      if (presetEpicGroup) {
        return { epicId: presetEpicGroup.rawId ?? presetEpicGroup.id };
      }

      if (taskModalState.presetEpicId) {
        return { epicId: taskModalState.presetEpicId };
      }

      return { epicId: "" };
    }, [taskModalState.initialValues, presetEpicGroup, taskModalState.presetEpicId]);

    const tabItems = useMemo<LayoutTabItem[]>(
      () =>
        taskGroups.map((group) => {
          const panelProps: TaskGroupPanelProps = {
            group,
            isActive: activeTab === group.id,
            onTaskClick: handleExistingTaskClick,
            ...(group.type === "epic" ? { onEpicEdit: handleEpicEdit } : {}),
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
      [taskGroups, activeTab, handleExistingTaskClick, handleEpicEdit],
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

        {epicModalState.open && (
          <AddEntityModal
            open={epicModalState.open}
            entityType="epic"
            groupLabel="Epics"
            optionCatalog={optionCatalog}
            onClose={closeEpicModal}
            onSubmit={handleEpicSubmit}
            initialValues={epicModalInitialValues}
            titleOverride={epicModalTitle}
            descriptionOverride={epicModalDescription}
            mode={epicModalState.mode}
          />
        )}

        {taskModalState.open && (
          <AddEntityModal
            open={taskModalState.open}
            entityType="task"
            groupLabel={presetEpicGroup ? `Task for ${presetEpicGroup.name}` : "Task"}
            optionCatalog={optionCatalog}
            onClose={closeTaskModal}
            onSubmit={handleTaskSubmit}
            initialValues={taskModalInitialValues}
            titleOverride={taskModalTitle}
            descriptionOverride={taskModalDescription}
            mode={taskModalState.mode}
          />
        )}
      </div>
    );
  },
);

TasksDiagram.displayName = "TasksDiagram";

export type { TasksDiagramHandle, TasksDiagramProps };
export default TasksDiagram;
