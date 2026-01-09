import { useQueryClient } from "@tanstack/react-query";
import { GitBranch } from "lucide-react";
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

interface FlowsReportProps {
  projectId: string;
  className?: string;
}

export const FlowsReport: React.FC<FlowsReportProps> = ({ projectId, className }) => {
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

  type FlowEntry = { key: string; name: string; data: Record<string, unknown> };

  const flows = useMemo<FlowEntry[]>(() => {
    const resolved = (data?.resolved as Record<string, unknown> | undefined) ?? {};
    const spec = (resolved as any).spec ?? resolved;
    const flowsSource = (spec as any).flows ?? (resolved as any).flows ?? [];

    const entries: FlowEntry[] = [];
    if (Array.isArray(flowsSource)) {
      flowsSource.forEach((flow, index) => {
        const name =
          typeof flow === "string" ? flow : (flow?.name ?? flow?.id ?? `flow-${index + 1}`);
        const data =
          typeof flow === "string" ? { name: flow } : ((flow as Record<string, unknown>) ?? {});
        entries.push({ key: `flow-${index}`, name, data });
      });
    } else if (flowsSource && typeof flowsSource === "object") {
      Object.entries(flowsSource as Record<string, unknown>).forEach(([key, value]) => {
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

  const buildInitialValues = useCallback((flow: FlowEntry) => {
    const description =
      typeof flow.data.description === "string" ? flow.data.description : undefined;
    return {
      name: flow.name,
      ...(description ? { description } : {}),
    } as Record<string, FieldValue>;
  }, []);

  return (
    <GenericEntityReport
      title="Flows"
      description="Business processes and workflows that span multiple services."
      icon={GitBranch}
      entityType="flow"
      projectId={projectId}
      items={flows}
      optionCatalog={uiOptionCatalog}
      emptyMessage="No flows found yet. Add one to track your business processes."
      isLoading={isLoading}
      isError={isError}
      errorMessage={
        error instanceof Error ? error.message : "Unable to load flows for this project."
      }
      className={className ?? ""}
      refresh={refreshResolved}
      buildInitialValues={buildInitialValues}
      renderCard={(flow, { openEdit }) => (
        <ArtifactCard
          key={flow.key}
          name={flow.name}
          data={flow.data}
          onClick={() => openEdit(flow)}
        />
      )}
      successMessages={{ create: "Flow added successfully", edit: "Flow updated successfully" }}
    />
  );
};

export default FlowsReport;
