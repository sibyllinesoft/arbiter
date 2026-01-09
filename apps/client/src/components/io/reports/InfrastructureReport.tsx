import { Shield } from "lucide-react";
import React, { useCallback, useEffect, useMemo } from "react";

import { GenericEntityReport } from "@/components/templates/GenericEntityReport";
import { useTabBadgeUpdater } from "@/contexts/TabBadgeContext";
import { useCatalog } from "@/hooks/useCatalog";
import type { ResolvedSpecResponse } from "@/types/api";
import ArtifactCard from "../../core/ArtifactCard";
import {
  DEFAULT_UI_OPTION_CATALOG,
  type FieldValue,
  type UiOptionCatalog,
} from "../../modals/entityTypes";

interface InfrastructureReportProps {
  projectId: string;
  className?: string;
}

export const InfrastructureReport: React.FC<InfrastructureReportProps> = ({
  projectId,
  className,
}) => {
  const catalog = useCatalog<ResolvedSpecResponse>(projectId);
  const { data, isLoading, isError, error } = catalog;
  const uiOptionCatalog = useMemo<UiOptionCatalog>(
    () => ({ ...DEFAULT_UI_OPTION_CATALOG, ...(catalog.uiOptionCatalog ?? {}) }),
    [catalog.uiOptionCatalog],
  );

  const refreshResolved = useCallback(async () => {
    await catalog.refresh({ silent: true });
  }, [catalog]);

  type InfrastructureEntry = { key: string; name: string; data: Record<string, unknown> };

  const infrastructure = useMemo<InfrastructureEntry[]>(() => {
    const resolved = (data?.resolved as Record<string, unknown> | undefined) ?? {};
    const spec = (resolved as any).spec ?? resolved;
    const componentsSource = (spec as any).components ?? (resolved as any).components ?? {};

    const entries: InfrastructureEntry[] = [];
    const isInfra = (value: Record<string, unknown>) => {
      const type = typeof value["type"] === "string" ? (value["type"] as string).toLowerCase() : "";
      return type === "infrastructure" || type === "deployment";
    };

    if (Array.isArray(componentsSource)) {
      componentsSource.forEach((comp, index) => {
        const normalized = (comp as Record<string, unknown>) ?? {};
        if (isInfra(normalized)) {
          const name = (normalized.name as string) ?? `infrastructure-${index + 1}`;
          entries.push({ key: `infra-${index}`, name, data: normalized });
        }
      });
    } else if (componentsSource && typeof componentsSource === "object") {
      Object.entries(componentsSource as Record<string, unknown>).forEach(([key, value]) => {
        const normalized = (value as Record<string, unknown>) ?? {};
        if (isInfra(normalized)) {
          const name = (normalized.name as string) ?? key;
          entries.push({ key, name, data: normalized });
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

  const buildInitialValues = useCallback((infra: InfrastructureEntry) => {
    const description =
      typeof infra.data.description === "string" ? infra.data.description : undefined;
    const type = typeof infra.data.type === "string" ? infra.data.type : undefined;
    return {
      name: infra.name,
      ...(description ? { description } : {}),
      ...(type ? { type } : {}),
    } as Record<string, FieldValue>;
  }, []);

  return (
    <GenericEntityReport
      title="Infrastructure"
      description="Deployment environments, Kubernetes resources, and infrastructure components."
      icon={Shield}
      entityType="infrastructure"
      projectId={projectId}
      items={infrastructure}
      optionCatalog={uiOptionCatalog}
      emptyMessage="No infrastructure found yet. Add one to track your deployment layer."
      isLoading={isLoading}
      isError={isError}
      errorMessage={
        error instanceof Error ? error.message : "Unable to load infrastructure for this project."
      }
      className={className ?? ""}
      refresh={refreshResolved}
      buildInitialValues={buildInitialValues}
      renderCard={(infra, { openEdit }) => (
        <ArtifactCard
          key={infra.key}
          name={infra.name}
          data={infra.data}
          onClick={() => openEdit(infra)}
        />
      )}
      successMessages={{
        create: "Infrastructure added successfully",
        edit: "Infrastructure updated successfully",
      }}
    />
  );
};

export default InfrastructureReport;
