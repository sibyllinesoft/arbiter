import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Sparkles } from "lucide-react";
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

interface CapabilitiesReportProps {
  projectId: string;
  className?: string;
}

export const CapabilitiesReport: React.FC<CapabilitiesReportProps> = ({ projectId, className }) => {
  const { data, isLoading, isError, error } = useResolvedSpec(projectId);
  const queryClient = useQueryClient();
  const [isAddCapabilityOpen, setIsAddCapabilityOpen] = useState(false);
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

  const handleOpenAddCapability = useCallback(() => {
    setIsAddCapabilityOpen(true);
  }, []);

  const handleCloseAddCapability = useCallback(() => {
    if (isCreating) return;
    setIsAddCapabilityOpen(false);
  }, [isCreating]);

  const handleSubmitAddCapability = useCallback(
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
        toast.success("Capability added successfully");
        setIsAddCapabilityOpen(false);
      }
    },
    [projectId, isCreating, persistEntity],
  );

  const capabilities = useMemo(() => {
    const resolved = data?.resolved as Record<string, any> | undefined;
    const spec = resolved?.spec ?? resolved;
    const capabilitiesSource = spec?.capabilities ?? resolved?.capabilities ?? [];

    const entries: Array<{ key: string; name: string; data: any }> = [];
    if (Array.isArray(capabilitiesSource)) {
      capabilitiesSource.forEach((capability, index) => {
        const name =
          typeof capability === "string"
            ? capability
            : (capability?.name ?? capability?.id ?? `capability-${index + 1}`);
        const data = typeof capability === "string" ? { name: capability } : capability;
        entries.push({ key: `capability-${index}`, name, data });
      });
    } else if (capabilitiesSource && typeof capabilitiesSource === "object") {
      Object.entries(capabilitiesSource).forEach(([key, value]) => {
        const name = typeof value === "string" ? value : ((value as any)?.name ?? key);
        const data = typeof value === "string" ? { name: value } : value;
        entries.push({ key, name, data });
      });
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.resolved]);

  const tabBadgeUpdater = useTabBadgeUpdater();
  const capabilityCount = isLoading || isError ? null : capabilities.length;

  useEffect(() => {
    if (!projectId || capabilityCount == null) {
      tabBadgeUpdater("capabilities", null);
      return () => {
        tabBadgeUpdater("capabilities", null);
      };
    }
    tabBadgeUpdater("capabilities", capabilityCount);
    return () => {
      tabBadgeUpdater("capabilities", null);
    };
  }, [capabilityCount, projectId, tabBadgeUpdater]);

  return (
    <>
      <div className={clsx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-gray-600 dark:text-graphite-300">
              Loading capabilities...
            </div>
          ) : isError ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-rose-600 dark:text-rose-400">
              {error instanceof Error
                ? error.message
                : "Unable to load capabilities for this project."}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              <EntityCatalog
                title="Capabilities"
                description="User-facing features and capabilities provided by your system."
                icon={Sparkles}
                items={capabilities}
                isLoading={isLoading}
                emptyMessage="No capabilities found yet. Add one to track your feature set."
                addAction={{
                  label: "Add Capability",
                  onAdd: handleOpenAddCapability,
                  disabled: !projectId || isCreating,
                  loading: isCreating,
                }}
                renderCard={(capability) => (
                  <ArtifactCard
                    key={capability.key}
                    name={capability.name}
                    data={capability.data}
                    onClick={() => {}}
                  />
                )}
              />
            </div>
          )}
        </div>
      </div>

      <AddEntityModal
        open={isAddCapabilityOpen}
        entityType="capability"
        groupLabel="Capabilities"
        optionCatalog={uiOptionCatalog}
        onClose={handleCloseAddCapability}
        mode="create"
        onSubmit={handleSubmitAddCapability}
      />
    </>
  );
};

export default CapabilitiesReport;
