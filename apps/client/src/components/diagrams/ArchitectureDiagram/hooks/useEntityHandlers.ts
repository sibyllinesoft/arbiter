import type { FieldValue, UiOptionCatalog } from "@/components/modals/entityTypes";
import { useProjectEntityPersistence } from "@/hooks/useProjectEntityPersistence";
import { apiService } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";
/**
 * @module ArchitectureDiagram/hooks/useEntityHandlers
 * Hook for entity CRUD operations in the architecture diagram.
 */
import { useCallback } from "react";
import type { ArchitectureDiagramProps, ArchitectureEntityModalRequest } from "../types";
import type { GroupedComponentGroup, GroupedComponentItem } from "../utils/componentGrouping";
import { buildInitialValuesFromMetadata } from "../utils/initialValues";

interface UseEntityHandlersParams {
  projectId: string;
  refreshProjectData: (options?: { silent?: boolean }) => Promise<void>;
  setError: (error: string | null) => void;
  toggleOptimisticRemoval: (artifactId: string, shouldAdd: boolean) => void;
  optionCatalogWithTasks: UiOptionCatalog;
  onOpenEntityModal?: ArchitectureDiagramProps["onOpenEntityModal"];
  setAddDialogConfig: (config: { type: string; label: string } | null) => void;
}

interface EntityHandlers {
  handleAddEntity: (payload: {
    entityType: string;
    values: Record<string, FieldValue>;
  }) => Promise<void>;
  openAddDialog: (group: GroupedComponentGroup) => void;
  handleEditComponent: (params: {
    group: GroupedComponentGroup;
    item: GroupedComponentItem;
  }) => void;
  handleDeleteEntity: (artifactId: string, label?: string) => Promise<void>;
}

/** Extract artifact ID from item data */
function extractArtifactId(item: GroupedComponentItem): string | null {
  const metadata = (item.data?.metadata ?? {}) as Record<string, unknown>;
  const candidates = [
    item.data?.artifactId,
    item.data?.id,
    metadata?.artifactId,
    metadata?.artifact_id,
    metadata?.entityId,
    metadata?.entity_id,
  ];
  return (
    candidates
      .find((c) => typeof c === "string" && c.trim().length > 0)
      ?.toString()
      .trim() ?? null
  );
}

/** Extract draft identifier from item data */
function extractDraftIdentifier(item: GroupedComponentItem): string | null {
  const metadata = (item.data?.metadata ?? {}) as Record<string, unknown>;
  const candidates = [metadata?.id, metadata?.slug, item.data?.slug, item.data?.id, item.name];
  return (
    candidates.map((c) => (typeof c === "string" ? c.trim() : "")).find((c) => c.length > 0) ?? null
  );
}

/** Build initial values for edit modal */
function buildEditInitialValues(
  group: GroupedComponentGroup,
  item: GroupedComponentItem,
): Record<string, FieldValue> {
  const metadata = (item.data?.metadata ?? {}) as Record<string, unknown>;
  const metadataInitialValues = buildInitialValuesFromMetadata(group.type, metadata);
  const initialValues: Record<string, FieldValue> = {
    ...metadataInitialValues,
    name: (item.data?.name as string | undefined)?.trim() || item.name,
  };

  const descriptionValue =
    (typeof item.data?.description === "string" ? item.data.description : undefined) ??
    (typeof metadata?.description === "string" ? (metadata.description as string) : undefined);
  if (descriptionValue?.trim().length) {
    initialValues.description = descriptionValue.trim();
  }

  if (group.type === "group") {
    const tasksValue = (metadata?.tasks as unknown) ?? item.data?.tasks;
    if (Array.isArray(tasksValue)) {
      const normalizedTasks = tasksValue
        .map((task) => {
          if (typeof task === "string") return task.trim();
          if (task && typeof task === "object") {
            const taskRecord = task as Record<string, unknown>;
            const candidate = taskRecord.id ?? taskRecord.name ?? taskRecord.slug;
            return typeof candidate === "string" ? candidate.trim() : "";
          }
          return "";
        })
        .filter((v) => v.length > 0);
      if (normalizedTasks.length > 0) {
        initialValues.tasks = normalizedTasks;
      }
    }
  }

  return initialValues;
}

/**
 * Hook for entity CRUD handlers
 */
export function useEntityHandlers({
  projectId,
  refreshProjectData,
  setError,
  toggleOptimisticRemoval,
  optionCatalogWithTasks,
  onOpenEntityModal,
  setAddDialogConfig,
}: UseEntityHandlersParams): EntityHandlers {
  const queryClient = useQueryClient();

  const { persistEntity } = useProjectEntityPersistence({
    projectId,
    refresh: refreshProjectData,
    setError,
  });

  const handleAddEntity = useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      const success = await persistEntity({
        entityType: payload.entityType,
        values: payload.values,
      });
      if (success) {
        setAddDialogConfig(null);
      }
    },
    [persistEntity, setAddDialogConfig],
  );

  const openAddDialog = useCallback(
    (group: GroupedComponentGroup) => {
      if (onOpenEntityModal) {
        const request: ArchitectureEntityModalRequest = {
          type: group.type,
          label: group.label,
          optionCatalog: optionCatalogWithTasks,
          mode: "create",
          onSubmit: handleAddEntity,
        };
        onOpenEntityModal(request);
        return;
      }
      setAddDialogConfig({ type: group.type, label: group.label });
    },
    [onOpenEntityModal, optionCatalogWithTasks, handleAddEntity, setAddDialogConfig],
  );

  const handleEditComponent = useCallback(
    ({ group, item }: { group: GroupedComponentGroup; item: GroupedComponentItem }) => {
      const artifactId = extractArtifactId(item);
      const draftIdentifier = extractDraftIdentifier(item);
      const initialValues = buildEditInitialValues(group, item);

      const titleOverride =
        initialValues.name && typeof initialValues.name === "string"
          ? `Update ${initialValues.name}`
          : undefined;
      const descriptionOverride = `Modify the ${group.label.toLowerCase()} details and save your changes.`;

      if (onOpenEntityModal) {
        const request: ArchitectureEntityModalRequest = {
          type: group.type,
          label: group.label,
          optionCatalog: optionCatalogWithTasks,
          mode: "edit",
          initialValues,
          ...(titleOverride ? { titleOverride } : {}),
          ...(descriptionOverride ? { descriptionOverride } : {}),
          onSubmit: async ({ entityType, values }) => {
            await persistEntity({ entityType, values, artifactId, draftIdentifier });
          },
        };
        onOpenEntityModal(request);
      } else {
        console.warn(
          "[ArchitectureDiagram] Edit modal requested but onOpenEntityModal was not provided.",
        );
      }
    },
    [onOpenEntityModal, optionCatalogWithTasks, persistEntity],
  );

  const handleDeleteEntity = useCallback(
    async (artifactId: string, label?: string) => {
      if (!projectId || !artifactId) {
        if (!artifactId) setError("Unable to delete artifact: missing identifier");
        return;
      }

      const labelPreview = label ? `"${label}"` : "";
      const confirmationMessage = labelPreview
        ? `Delete ${labelPreview} from the architecture?`
        : "Delete this artifact from the architecture?";
      if (typeof window !== "undefined" && !window.confirm(confirmationMessage)) {
        return;
      }

      toggleOptimisticRemoval(artifactId, true);

      try {
        await apiService.deleteProjectEntity(projectId, artifactId);
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        refreshProjectData({ silent: true })
          .then(() => toggleOptimisticRemoval(artifactId, false))
          .catch((refreshError) => {
            console.error("[ArchitectureDiagram] failed to refresh after deletion", refreshError);
            toggleOptimisticRemoval(artifactId, false);
          });
      } catch (err: any) {
        toggleOptimisticRemoval(artifactId, false);
        console.error("[ArchitectureDiagram] failed to delete entity", err);
        setError(err?.message || "Failed to delete entity");
      }
    },
    [projectId, queryClient, refreshProjectData, toggleOptimisticRemoval, setError],
  );

  return { handleAddEntity, openAddDialog, handleEditComponent, handleDeleteEntity };
}
