import { useQueryClient } from "@tanstack/react-query";
import { Component } from "lucide-react";
import React, { useCallback, useEffect, useMemo } from "react";

import { GenericEntityReport } from "@/components/templates/GenericEntityReport";
import { useTabBadgeUpdater } from "@/contexts/TabBadgeContext";
import { useResolvedSpec, useUiOptionCatalog } from "@/hooks/api-hooks";
import ArtifactCard from "../core/ArtifactCard";
import {
  DEFAULT_UI_OPTION_CATALOG,
  type FieldValue,
  type UiOptionCatalog,
} from "../modals/entityTypes";

interface PackagesReportProps {
  projectId: string;
  className?: string;
}

export const PackagesReport: React.FC<PackagesReportProps> = ({ projectId, className }) => {
  const { data, isLoading, isError, error } = useResolvedSpec(projectId);
  const queryClient = useQueryClient();
  const { data: uiOptionCatalogData } = useUiOptionCatalog();
  const uiOptionCatalog = useMemo<UiOptionCatalog>(
    () => ({ ...DEFAULT_UI_OPTION_CATALOG, ...(uiOptionCatalogData ?? {}) }),
    [uiOptionCatalogData],
  );

  const refreshResolved = useCallback(async () => {
    if (!projectId) return;
    await queryClient.invalidateQueries({ queryKey: ["resolved-spec", projectId] });
    await queryClient.refetchQueries({
      queryKey: ["resolved-spec", projectId],
      type: "active",
    });
  }, [projectId, queryClient]);

  type PackageEntry = { key: string; name: string; data: Record<string, unknown> };

  const packages = useMemo<PackageEntry[]>(() => {
    const resolved = (data?.resolved as Record<string, unknown> | undefined) ?? {};
    const spec = ((resolved as any).spec ?? resolved) as Record<string, unknown>;
    const componentsSource = (spec as any).components ?? (resolved as any).components ?? {};

    const entries: PackageEntry[] = [];
    const isPackageType = (comp: Record<string, unknown>): boolean =>
      typeof comp["type"] === "string"
        ? (comp["type"] as string).toLowerCase() === "package"
        : false;

    if (Array.isArray(componentsSource)) {
      componentsSource.forEach((comp, index) => {
        const normalized = (comp as Record<string, unknown>) ?? {};
        if (isPackageType(normalized)) {
          const name = (normalized.name as string) ?? `package-${index + 1}`;
          entries.push({ key: `package-${index}`, name, data: normalized });
        }
      });
    } else if (componentsSource && typeof componentsSource === "object") {
      Object.entries(componentsSource as Record<string, unknown>).forEach(([key, value]) => {
        const normalized = (value as Record<string, unknown>) ?? {};
        if (isPackageType(normalized)) {
          const name = (normalized.name as string) ?? key;
          entries.push({ key, name, data: normalized });
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

  const buildInitialValues = useCallback((pkg: PackageEntry) => {
    const description = typeof pkg.data.description === "string" ? pkg.data.description : undefined;
    const version = typeof pkg.data.version === "string" ? pkg.data.version : undefined;
    const type = typeof pkg.data.type === "string" ? pkg.data.type : undefined;
    return {
      name: pkg.name,
      ...(description ? { description } : {}),
      ...(version ? { version } : {}),
      ...(type ? { type } : {}),
    } as Record<string, FieldValue>;
  }, []);

  return (
    <GenericEntityReport
      title="Packages"
      description="Reusable libraries and packages within your codebase."
      icon={Component}
      entityType="package"
      projectId={projectId}
      items={packages}
      optionCatalog={uiOptionCatalog}
      emptyMessage="No packages found yet. Add one to track your shared libraries."
      isLoading={isLoading}
      isError={isError}
      errorMessage={
        error instanceof Error ? error.message : "Unable to load packages for this project."
      }
      className={className ?? ""}
      refresh={refreshResolved}
      buildInitialValues={buildInitialValues}
      renderCard={(pkg, { openEdit }) => (
        <ArtifactCard key={pkg.key} name={pkg.name} data={pkg.data} onClick={() => openEdit(pkg)} />
      )}
      successMessages={{
        create: "Package added successfully",
        edit: "Package updated successfully",
      }}
    />
  );
};

export default PackagesReport;
