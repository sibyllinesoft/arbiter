/**
 * State management hooks for the TasksDiagram component.
 * Extracts complex state logic for better maintainability.
 */
import { coerceFieldValueToString } from "@/components/modals/AddEntityModal";
import {
  DEFAULT_UI_OPTION_CATALOG,
  type FieldValue,
  type UiOptionCatalog,
} from "@/components/modals/entityTypes";
import { apiService } from "@/services/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildTaskGroups } from "../normalizers";
import { extractTaskGroupOptions } from "../taskOptionExtractor";
import type { NormalizedTask, NormalizedTaskGroup, ResolvedSpec } from "../types";
import { slugify } from "../utils";

/** Modal state for group editing */
export interface GroupModalState {
  open: boolean;
  initialValues: Record<string, FieldValue> | null;
  mode: "create" | "edit";
  targetArtifactId: string | null;
  draftIdentifier: string | null;
}

/** Modal state for task editing */
export interface TaskModalState {
  open: boolean;
  presetGroupId: string | null;
  initialValues: Record<string, FieldValue> | null;
  mode: "create" | "edit";
  targetArtifactId: string | null;
}

const INITIAL_GROUP_MODAL: GroupModalState = {
  open: false,
  initialValues: null,
  mode: "create",
  targetArtifactId: null,
  draftIdentifier: null,
};

const INITIAL_TASK_MODAL: TaskModalState = {
  open: false,
  presetGroupId: null,
  initialValues: null,
  mode: "create",
  targetArtifactId: null,
};

/** Hook for managing resolved spec data */
export function useResolvedSpec(projectId: string | undefined) {
  const [resolved, setResolved] = useState<ResolvedSpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        if (!silent) setLoading(true);
        setError(null);
        const response = await apiService.getResolvedSpec(projectId);
        if (!isMountedRef.current) return;
        setResolved(response.resolved as ResolvedSpec);
      } catch (err) {
        console.error("Failed to load group/task data", err);
        if (!isMountedRef.current) return;
        setResolved(null);
        setError(err instanceof Error ? err.message : "Failed to load tasks");
        throw err;
      } finally {
        if (!silent && isMountedRef.current) setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    loadResolved().catch(() => {});
  }, [loadResolved]);

  const clearError = useCallback(() => setError(null), []);

  return { resolved, loading, error, loadResolved, clearError, isMountedRef };
}

/** Hook for managing UI option catalog */
export function useUiOptionCatalog(taskGroups: NormalizedTaskGroup[]) {
  const [uiOptionCatalog, setUiOptionCatalog] =
    useState<UiOptionCatalog>(DEFAULT_UI_OPTION_CATALOG);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const options = await apiService.getUiOptionCatalog();
        if (!active || !options) return;
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

  const { openTaskOptions, groupSelectionOptions } = useMemo(
    () => extractTaskGroupOptions(taskGroups),
    [taskGroups],
  );

  const optionCatalog = useMemo<UiOptionCatalog>(
    () => ({
      ...uiOptionCatalog,
      groupIssueOptions: openTaskOptions,
      issueGroupOptions: groupSelectionOptions,
    }),
    [uiOptionCatalog, openTaskOptions, groupSelectionOptions],
  );

  return { optionCatalog };
}

/** Hook for managing group modal state */
export function useGroupModal() {
  const [state, setState] = useState<GroupModalState>(INITIAL_GROUP_MODAL);

  const open = useCallback((group?: NormalizedTaskGroup) => {
    if (group && group.type === "group") {
      setState({
        open: true,
        initialValues: { name: group.name, description: group.description ?? "" },
        mode: "edit",
        targetArtifactId: group.artifactId ?? null,
        draftIdentifier: group.rawId ?? group.id ?? null,
      });
    } else {
      setState({
        open: true,
        initialValues: { name: "", description: "" },
        mode: "create",
        targetArtifactId: null,
        draftIdentifier: null,
      });
    }
  }, []);

  const close = useCallback(() => {
    setState(INITIAL_GROUP_MODAL);
  }, []);

  return { state, open, close };
}

/** Hook for managing task modal state */
export function useTaskModal() {
  const [state, setState] = useState<TaskModalState>(INITIAL_TASK_MODAL);

  const open = useCallback((group?: NormalizedTaskGroup | null) => {
    if (group && group.type === "group") {
      const groupIdentifier = group.rawId ?? group.id;
      setState({
        open: true,
        presetGroupId: groupIdentifier,
        initialValues: { groupId: groupIdentifier },
        mode: "create",
        targetArtifactId: null,
      });
    } else {
      setState({
        open: true,
        presetGroupId: null,
        initialValues: { groupId: "" },
        mode: "create",
        targetArtifactId: null,
      });
    }
  }, []);

  const openForEdit = useCallback((task: NormalizedTask) => {
    const initialValues: Record<string, FieldValue> = {
      name: task.name ?? task.rawId ?? "",
      groupId: task.groupId ?? "",
    };
    if (task.description) {
      initialValues.description = task.description;
    }
    setState({
      open: true,
      presetGroupId: task.groupId ?? null,
      initialValues,
      mode: "edit",
      targetArtifactId: task.artifactId ?? null,
    });
  }, []);

  const close = useCallback(() => {
    setState(INITIAL_TASK_MODAL);
  }, []);

  return { state, open, openForEdit, close };
}

/** Hook for building group lookup map */
export function useGroupLookup(taskGroups: NormalizedTaskGroup[]) {
  return useMemo(() => {
    const map = new Map<string, NormalizedTaskGroup>();
    for (const group of taskGroups) {
      if (group.type !== "group") continue;
      const identifiers = [group.id, group.rawId ?? "", group.artifactId ?? ""];
      for (const id of identifiers.filter(Boolean)) {
        map.set(id, group);
        map.set(slugify(id), group);
      }
    }
    return map;
  }, [taskGroups]);
}

/** Hook for computing task groups from resolved spec */
export function useTaskGroups(resolved: ResolvedSpec | null) {
  return useMemo(() => buildTaskGroups(resolved), [resolved]);
}

/** Hook for modal title and description computation */
export function useModalText(modalState: GroupModalState | TaskModalState, type: "group" | "task") {
  const title = useMemo(() => {
    const label = type === "group" ? "Group" : "Task";
    if (modalState.mode === "edit") {
      const name = coerceFieldValueToString(modalState.initialValues?.name).trim();
      return name.length > 0 ? `Update ${label}: ${name}` : `Update ${label}`;
    }
    return `Add ${label}`;
  }, [modalState.mode, modalState.initialValues, type]);

  const description = useMemo(() => {
    const label = type.toLowerCase();
    return modalState.mode === "edit"
      ? `Review and update the selected ${label}. Changes will be saved to the project.`
      : `Provide the details needed to add a new ${label}.`;
  }, [modalState.mode, type]);

  return { title, description };
}

/** Resolve group identifier from modal state */
function resolveGroupIdentifier(
  values: Record<string, FieldValue>,
  draftIdentifier: string | null,
): string {
  const incomingId = typeof values.id === "string" ? values.id.trim() : "";
  const incomingSlug = typeof values.slug === "string" ? values.slug.trim() : "";
  return incomingId || incomingSlug || draftIdentifier || "";
}

/** Resolve group from raw value using lookup */
function resolveGroupFromValue(
  rawGroupValue: string,
  groupLookup: Map<string, NormalizedTaskGroup>,
): { finalGroupId: string; finalGroupName: string } {
  const trimmedGroupId = rawGroupValue.trim();
  if (trimmedGroupId.length === 0) {
    return { finalGroupId: "", finalGroupName: "" };
  }
  const resolvedGroup = groupLookup.get(trimmedGroupId) ?? groupLookup.get(slugify(trimmedGroupId));
  const finalGroupId = resolvedGroup ? (resolvedGroup.rawId ?? resolvedGroup.id) : trimmedGroupId;
  const finalGroupName = resolvedGroup?.name ?? trimmedGroupId;
  return { finalGroupId, finalGroupName };
}

/** Hook for building group submit handler */
export function useGroupSubmitHandler(
  projectId: string | undefined,
  loadResolved: (options?: { silent?: boolean }) => Promise<void>,
  isMountedRef: React.MutableRefObject<boolean>,
  clearError: () => void,
  groupModalState: GroupModalState,
) {
  return useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      if (!projectId) return;
      const valuesWithContext = { ...payload.values };
      const resolvedIdentifier = resolveGroupIdentifier(
        valuesWithContext,
        groupModalState.draftIdentifier,
      );

      if (resolvedIdentifier) {
        valuesWithContext.id = resolvedIdentifier;
        valuesWithContext.slug = resolvedIdentifier;
      }

      try {
        if (groupModalState.targetArtifactId) {
          await apiService.updateProjectEntity(projectId, groupModalState.targetArtifactId, {
            type: payload.entityType,
            values: valuesWithContext,
          });
        } else {
          await apiService.createProjectEntity(projectId, {
            type: payload.entityType,
            values: valuesWithContext,
          });
        }
        await loadResolved({ silent: true });
        if (isMountedRef.current) clearError();
      } catch (err) {
        console.error("[TasksDiagram] failed to create group", err);
        throw err;
      }
    },
    [
      projectId,
      loadResolved,
      isMountedRef,
      clearError,
      groupModalState.targetArtifactId,
      groupModalState.draftIdentifier,
    ],
  );
}

/** Hook for building task submit handler */
export function useTaskSubmitHandler(
  projectId: string | undefined,
  loadResolved: (options?: { silent?: boolean }) => Promise<void>,
  isMountedRef: React.MutableRefObject<boolean>,
  clearError: () => void,
  taskModalState: TaskModalState,
  groupLookup: Map<string, NormalizedTaskGroup>,
) {
  return useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      if (!projectId) return;
      const valuesWithContext: Record<string, FieldValue> = { ...payload.values };

      // Extract raw group value from various possible fields
      const rawGroupValue =
        coerceFieldValueToString(valuesWithContext.groupId).trim() ||
        coerceFieldValueToString(valuesWithContext.group).trim() ||
        (typeof taskModalState.presetGroupId === "string" ? taskModalState.presetGroupId : "");

      // Clean up group-related fields
      delete valuesWithContext.group;
      delete valuesWithContext.groupId;
      delete valuesWithContext.groupName;

      // Resolve and set group fields
      const { finalGroupId, finalGroupName } = resolveGroupFromValue(rawGroupValue, groupLookup);
      if (finalGroupId) {
        valuesWithContext.groupId = finalGroupId;
        valuesWithContext.group = finalGroupId;
        valuesWithContext.groupName = finalGroupName;
      }

      // Preserve target artifact ID for edits
      const targetId = taskModalState.targetArtifactId;
      if (targetId) valuesWithContext.id = targetId;

      try {
        if (targetId) {
          await apiService.updateProjectEntity(projectId, targetId, {
            type: payload.entityType,
            values: valuesWithContext,
          });
        } else {
          await apiService.createProjectEntity(projectId, {
            type: payload.entityType,
            values: valuesWithContext,
          });
        }
        await loadResolved({ silent: true });
        if (isMountedRef.current) clearError();
      } catch (err) {
        console.error("[TasksDiagram] failed to create task", err);
        throw err;
      }
    },
    [
      projectId,
      loadResolved,
      isMountedRef,
      clearError,
      taskModalState.presetGroupId,
      taskModalState.targetArtifactId,
      groupLookup,
    ],
  );
}
