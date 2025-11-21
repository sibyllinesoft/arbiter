import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Component } from "lucide-react";
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

interface PackagesReportProps {
  projectId: string;
  className?: string;
}

export const PackagesReport: React.FC<PackagesReportProps> = ({ projectId, className }) => {
  const { data, isLoading, isError, error } = useResolvedSpec(projectId);
  const queryClient = useQueryClient();
  const [isAddPackageOpen, setIsAddPackageOpen] = useState(false);
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

  const handleOpenAddPackage = useCallback(() => {
    setIsAddPackageOpen(true);
  }, []);

  const handleCloseAddPackage = useCallback(() => {
    if (isCreating) return;
    setIsAddPackageOpen(false);
  }, [isCreating]);

  const handleSubmitAddPackage = useCallback(
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
        toast.success("Package added successfully");
        setIsAddPackageOpen(false);
      }
    },
    [projectId, isCreating, persistEntity],
  );

  const packages = useMemo(() => {
    const resolved = data?.resolved as Record<string, any> | undefined;
    const spec = resolved?.spec ?? resolved;
    const componentsSource = spec?.components ?? resolved?.components ?? {};

    const entries: Array<{ key: string; name: string; data: any }> = [];
    if (Array.isArray(componentsSource)) {
      componentsSource.forEach((comp, index) => {
        const type = comp?.type?.toString().toLowerCase() ?? "";
        if (type === "module" || type === "library") {
          const name = comp?.name ?? `package-${index + 1}`;
          entries.push({ key: `package-${index}`, name, data: comp });
        }
      });
    } else if (componentsSource && typeof componentsSource === "object") {
      Object.entries(componentsSource).forEach(([key, value]) => {
        const type = (value as any)?.type?.toString().toLowerCase() ?? "";
        if (type === "module" || type === "library") {
          const name = (value as any)?.name ?? key;
          entries.push({ key, name, data: value });
        }
      });
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.resolved]);

  const tabBadgeUpdater = useTabBadgeUpdater();
  const packageCount = isLoading || isError ? null : packages.length;

  useEffect(() => {
    if (!projectId || packageCount == null) {
      tabBadgeUpdater("packages", null);
      return () => {
        tabBadgeUpdater("packages", null);
      };
    }
    tabBadgeUpdater("packages", packageCount);
    return () => {
      tabBadgeUpdater("packages", null);
    };
  }, [packageCount, projectId, tabBadgeUpdater]);

  return (
    <>
      <div className={clsx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-gray-600 dark:text-graphite-300">
              Loading packages...
            </div>
          ) : isError ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-rose-600 dark:text-rose-400">
              {error instanceof Error ? error.message : "Unable to load packages for this project."}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              <EntityCatalog
                title="Packages"
                description="Reusable libraries and packages within your codebase."
                icon={Component}
                items={packages}
                isLoading={isLoading}
                emptyMessage="No packages found yet. Add one to track your shared libraries."
                addAction={{
                  label: "Add Package",
                  onAdd: handleOpenAddPackage,
                  disabled: !projectId || isCreating,
                  loading: isCreating,
                }}
                renderCard={(pkg) => (
                  <ArtifactCard key={pkg.key} name={pkg.name} data={pkg.data} onClick={() => {}} />
                )}
              />
            </div>
          )}
        </div>
      </div>

      <AddEntityModal
        open={isAddPackageOpen}
        entityType="module"
        groupLabel="Packages"
        optionCatalog={uiOptionCatalog}
        onClose={handleCloseAddPackage}
        mode="create"
        onSubmit={handleSubmitAddPackage}
      />
    </>
  );
};

export default PackagesReport;
