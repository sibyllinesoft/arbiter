import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
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

interface CapabilitiesReportProps {
  projectId: string;
  className?: string;
}

export const CapabilitiesReport: React.FC<CapabilitiesReportProps> = ({ projectId, className }) => {
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

  type CapabilityEntry = { key: string; name: string; data: Record<string, unknown> };

  const capabilities = useMemo<CapabilityEntry[]>(() => {
    const resolved = (data?.resolved as Record<string, unknown> | undefined) ?? {};
    const spec = (resolved as any).spec ?? resolved;
    const capabilitiesSource = (spec as any).capabilities ?? (resolved as any).capabilities ?? [];

    const entries: CapabilityEntry[] = [];
    if (Array.isArray(capabilitiesSource)) {
      capabilitiesSource.forEach((capability, index) => {
        const name =
          typeof capability === "string"
            ? capability
            : (capability?.name ?? capability?.id ?? `capability-${index + 1}`);
        const data =
          typeof capability === "string"
            ? { name: capability }
            : ((capability as Record<string, unknown>) ?? {});
        entries.push({ key: `capability-${index}`, name, data });
      });
    } else if (capabilitiesSource && typeof capabilitiesSource === "object") {
      Object.entries(capabilitiesSource as Record<string, unknown>).forEach(([key, value]) => {
        const name =
          typeof value === "string"
            ? value
            : (((value as Record<string, unknown>)?.name as string | undefined) ?? key);
        const data =
          typeof value === "string" ? { name: value } : ((value as Record<string, unknown>) ?? {});
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

  const buildInitialValues = useCallback((item: CapabilityEntry) => {
    const description =
      typeof item.data.description === "string" ? item.data.description : undefined;
    return {
      name: item.name,
      ...(description ? { description } : {}),
    } as Record<string, FieldValue>;
  }, []);

  return (
    <GenericEntityReport
      title="Capabilities"
      description="User-facing features and capabilities provided by your system."
      icon={Sparkles}
      entityType="capability"
      projectId={projectId}
      items={capabilities}
      optionCatalog={uiOptionCatalog}
      emptyMessage="No capabilities found yet. Add one to track your feature set."
      isLoading={isLoading}
      isError={isError}
      errorMessage={
        error instanceof Error ? error.message : "Unable to load capabilities for this project."
      }
      className={className ?? ""}
      refresh={refreshResolved}
      buildInitialValues={buildInitialValues}
      renderCard={(capability, { openEdit }) => (
        <ArtifactCard
          key={capability.key}
          name={capability.name}
          data={capability.data}
          onClick={() => openEdit(capability)}
        />
      )}
      successMessages={{
        create: "Capability added successfully",
        edit: "Capability updated successfully",
      }}
    />
  );
};

export default CapabilitiesReport;
