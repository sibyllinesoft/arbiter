import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { GitBranch } from "lucide-react";
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

interface FlowsReportProps {
  projectId: string;
  className?: string;
}

export const FlowsReport: React.FC<FlowsReportProps> = ({ projectId, className }) => {
  const { data, isLoading, isError, error } = useResolvedSpec(projectId);
  const queryClient = useQueryClient();
  const [isAddFlowOpen, setIsAddFlowOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
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

  const handleOpenAddFlow = useCallback(() => {
    setIsAddFlowOpen(true);
  }, []);

  const handleCloseAddFlow = useCallback(() => {
    if (isCreating) return;
    setIsAddFlowOpen(false);
  }, [isCreating]);

  const handleSubmitAddFlow = useCallback(
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
        toast.success("Flow added successfully");
        setIsAddFlowOpen(false);
      }
    },
    [projectId, isCreating, persistEntity],
  );

  const flows = useMemo(() => {
    const resolved = data?.resolved as Record<string, any> | undefined;
    const spec = resolved?.spec ?? resolved;
    const flowsSource = spec?.flows ?? resolved?.flows ?? [];

    const entries: Array<{ key: string; name: string; data: any }> = [];
    if (Array.isArray(flowsSource)) {
      flowsSource.forEach((flow, index) => {
        const name =
          typeof flow === "string" ? flow : (flow?.name ?? flow?.id ?? `flow-${index + 1}`);
        const data = typeof flow === "string" ? { name: flow } : flow;
        entries.push({ key: `flow-${index}`, name, data });
      });
    } else if (flowsSource && typeof flowsSource === "object") {
      Object.entries(flowsSource).forEach(([key, value]) => {
        const name = typeof value === "string" ? value : ((value as any)?.name ?? key);
        const data = typeof value === "string" ? { name: value } : value;
        entries.push({ key, name, data });
      });
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.resolved]);

  const tabBadgeUpdater = useTabBadgeUpdater();
  const flowCount = isLoading || isError ? null : flows.length;

  useEffect(() => {
    if (!projectId || flowCount == null) {
      tabBadgeUpdater("flows", null);
      return () => {
        tabBadgeUpdater("flows", null);
      };
    }
    tabBadgeUpdater("flows", flowCount);
    return () => {
      tabBadgeUpdater("flows", null);
    };
  }, [flowCount, projectId, tabBadgeUpdater]);

  return (
    <>
      <div className={clsx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-gray-600 dark:text-graphite-300">
              Loading flows...
            </div>
          ) : isError ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-rose-600 dark:text-rose-400">
              {error instanceof Error ? error.message : "Unable to load flows for this project."}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              <EntityCatalog
                title="Flows"
                description="Business processes and workflows that span multiple services."
                icon={GitBranch}
                items={flows}
                isLoading={isLoading}
                emptyMessage="No flows found yet. Add one to track your business processes."
                addAction={{
                  label: "Add Flow",
                  onAdd: handleOpenAddFlow,
                  disabled: !projectId || isCreating,
                  loading: isCreating,
                }}
                renderCard={(flow) => (
                  <ArtifactCard
                    key={flow.key}
                    name={flow.name}
                    data={flow.data}
                    onClick={() => {}}
                  />
                )}
              />
            </div>
          )}
        </div>
      </div>

      <AddEntityModal
        open={isAddFlowOpen}
        entityType="flow"
        groupLabel="Flows"
        optionCatalog={uiOptionCatalog}
        onClose={handleCloseAddFlow}
        mode="create"
        onSubmit={handleSubmitAddFlow}
      />
    </>
  );
};

export default FlowsReport;
