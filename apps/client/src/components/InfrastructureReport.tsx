import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Shield } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { useTabBadgeUpdater } from "@/contexts/TabBadgeContext";
import { useResolvedSpec, useUiOptionCatalog } from "@/hooks/api-hooks";
import { useProjectEntityPersistence } from "@/hooks/useProjectEntityPersistence";
import ArtifactCard from "./ArtifactCard";
import AddEntityModal from "./modals/AddEntityModal";
import {
  DEFAULT_UI_OPTION_CATALOG,
  type FieldValue,
  type UiOptionCatalog,
} from "./modals/entityTypes";
import { EntityCatalog } from "./templates/EntityCatalog";

interface InfrastructureReportProps {
  projectId: string;
  className?: string;
}

export const InfrastructureReport: React.FC<InfrastructureReportProps> = ({
  projectId,
  className,
}) => {
  const { data, isLoading, isError, error } = useResolvedSpec(projectId);
  const queryClient = useQueryClient();
  const [isAddInfraOpen, setIsAddInfraOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editInfraState, setEditInfraState] = useState<{
    open: boolean;
    infra: { key: string; name: string; data: any } | null;
    initialValues?: Record<string, FieldValue>;
  }>({ open: false, infra: null });
  const { data: uiOptionCatalogData } = useUiOptionCatalog();
  const uiOptionCatalog = useMemo<UiOptionCatalog>(
    () => ({ ...DEFAULT_UI_OPTION_CATALOG, ...(uiOptionCatalogData ?? {}) }),
    [uiOptionCatalogData],
  );

  const refreshResolved = useCallback(
    async (_options: { silent?: boolean } = {}) => {
      if (!projectId) return;
      await queryClient.invalidateQueries({ queryKey: ["resolved-spec", projectId] });
      await queryClient.refetchQueries({
        queryKey: ["resolved-spec", projectId],
        type: "active",
      });
    },
    [projectId, queryClient],
  );

  const { persistEntity } = useProjectEntityPersistence({
    projectId,
    refresh: refreshResolved,
    setError: (message) => {
      if (message) {
        toast.error(message);
      }
    },
  });

  const handleOpenAddInfra = useCallback(() => {
    setIsAddInfraOpen(true);
  }, []);

  const handleCloseAddInfra = useCallback(() => {
    if (isCreating) return;
    setIsAddInfraOpen(false);
  }, [isCreating]);

  const handleSubmitAddInfra = useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      if (!projectId || isCreating) {
        return;
      }

      setIsCreating(true);
      const success = await persistEntity({
        entityType: payload.entityType,
        values: payload.values,
      });

      setIsCreating(false);
      if (success) {
        toast.success("Infrastructure added successfully");
        setIsAddInfraOpen(false);
      }
    },
    [projectId, isCreating, persistEntity],
  );

  const handleOpenEditInfra = useCallback((infra: { key: string; name: string; data: any }) => {
    const initialValues: Record<string, FieldValue> = {
      name: infra.name,
      ...(infra.data?.description ? { description: infra.data.description } : {}),
      ...(infra.data?.type ? { type: infra.data.type } : {}),
    };
    setEditInfraState({
      open: true,
      infra,
      initialValues,
    });
  }, []);

  const handleCloseEditInfra = useCallback(() => {
    setEditInfraState({ open: false, infra: null });
  }, []);

  const handleSubmitEditInfra = useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      if (!projectId || isCreating) {
        return;
      }

      setIsCreating(true);
      const success = await persistEntity({
        entityType: payload.entityType,
        values: payload.values,
      });

      setIsCreating(false);
      if (success) {
        toast.success("Infrastructure updated successfully");
        setEditInfraState({ open: false, infra: null });
      }
    },
    [projectId, isCreating, persistEntity],
  );

  const infrastructure = useMemo(() => {
    const resolved = data?.resolved as Record<string, any> | undefined;
    const spec = resolved?.spec ?? resolved;
    const componentsSource = spec?.components ?? resolved?.components ?? {};

    const entries: Array<{ key: string; name: string; data: any }> = [];
    if (Array.isArray(componentsSource)) {
      componentsSource.forEach((comp, index) => {
        const type = comp?.type?.toString().toLowerCase() ?? "";
        if (type === "infrastructure" || type === "deployment") {
          const name = comp?.name ?? `infrastructure-${index + 1}`;
          entries.push({ key: `infra-${index}`, name, data: comp });
        }
      });
    } else if (componentsSource && typeof componentsSource === "object") {
      Object.entries(componentsSource).forEach(([key, value]) => {
        const type = (value as any)?.type?.toString().toLowerCase() ?? "";
        if (type === "infrastructure" || type === "deployment") {
          const name = (value as any)?.name ?? key;
          entries.push({ key, name, data: value });
        }
      });
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.resolved]);

  const tabBadgeUpdater = useTabBadgeUpdater();
  const infraCount = isLoading || isError ? null : infrastructure.length;

  useEffect(() => {
    if (!projectId || infraCount == null) {
      tabBadgeUpdater("infrastructure", null);
      return () => {
        tabBadgeUpdater("infrastructure", null);
      };
    }
    tabBadgeUpdater("infrastructure", infraCount);
    return () => {
      tabBadgeUpdater("infrastructure", null);
    };
  }, [infraCount, projectId, tabBadgeUpdater]);

  return (
    <>
      <div className={clsx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-gray-600 dark:text-graphite-300">
              Loading infrastructure...
            </div>
          ) : isError ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-rose-600 dark:text-rose-400">
              {error instanceof Error
                ? error.message
                : "Unable to load infrastructure for this project."}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              <EntityCatalog
                title="Infrastructure"
                description="Deployment environments, Kubernetes resources, and infrastructure components."
                icon={Shield}
                items={infrastructure}
                isLoading={isLoading}
                emptyMessage="No infrastructure found yet. Add one to track your deployment layer."
                addAction={{
                  label: "Add Infrastructure",
                  onAdd: handleOpenAddInfra,
                  disabled: !projectId || isCreating,
                  loading: isCreating,
                }}
                renderCard={(infra) => (
                  <ArtifactCard
                    key={infra.key}
                    name={infra.name}
                    data={infra.data}
                    onClick={() => handleOpenEditInfra(infra)}
                  />
                )}
              />
            </div>
          )}
        </div>
      </div>

      <AddEntityModal
        open={isAddInfraOpen}
        entityType="infrastructure"
        groupLabel="Infrastructure"
        optionCatalog={uiOptionCatalog}
        onClose={handleCloseAddInfra}
        mode="create"
        onSubmit={handleSubmitAddInfra}
      />

      {editInfraState.open && (
        <AddEntityModal
          open={editInfraState.open}
          entityType="infrastructure"
          groupLabel="Infrastructure"
          optionCatalog={uiOptionCatalog}
          onClose={handleCloseEditInfra}
          mode="edit"
          initialValues={editInfraState.initialValues}
          titleOverride={
            editInfraState.infra ? `Update ${editInfraState.infra.name}` : "Update Infrastructure"
          }
          onSubmit={handleSubmitEditInfra}
        />
      )}
    </>
  );
};

export default InfrastructureReport;
