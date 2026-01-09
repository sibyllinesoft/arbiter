import { useQueryClient } from "@tanstack/react-query";
import { Terminal } from "lucide-react";
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

interface ToolsReportProps {
  projectId: string;
  className?: string;
}

export const ToolsReport: React.FC<ToolsReportProps> = ({ projectId, className }) => {
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

  type ToolEntry = { key: string; name: string; data: Record<string, unknown> };

  const tools = useMemo<ToolEntry[]>(() => {
    const resolved = (data?.resolved as Record<string, unknown> | undefined) ?? {};
    const spec = ((resolved as any).spec ?? resolved) as Record<string, unknown>;
    const componentsSource = (spec as any).components ?? (resolved as any).components ?? {};

    const entries: ToolEntry[] = [];
    const isTool = (comp: Record<string, unknown>): boolean => {
      const type = typeof comp["type"] === "string" ? (comp["type"] as string).toLowerCase() : "";
      const detectedType =
        typeof (comp["metadata"] as Record<string, unknown> | undefined)?.["detectedType"] ===
        "string"
          ? (
              (comp["metadata"] as Record<string, unknown>)?.["detectedType"] as string
            ).toLowerCase()
          : "";
      return (
        type === "tool" ||
        type === "cli" ||
        type === "binary" ||
        detectedType === "tool" ||
        detectedType === "build_tool"
      );
    };

    if (Array.isArray(componentsSource)) {
      componentsSource.forEach((comp, index) => {
        const normalized = (comp as Record<string, unknown>) ?? {};
        if (isTool(normalized)) {
          const name = (normalized.name as string) ?? `tool-${index + 1}`;
          entries.push({ key: `tool-${index}`, name, data: normalized });
        }
      });
    } else if (componentsSource && typeof componentsSource === "object") {
      Object.entries(componentsSource as Record<string, unknown>).forEach(([key, value]) => {
        const normalized = (value as Record<string, unknown>) ?? {};
        if (isTool(normalized)) {
          const name = (normalized.name as string) ?? key;
          entries.push({ key, name, data: normalized });
        }
      });
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.resolved]);

  const tabBadgeUpdater = useTabBadgeUpdater();
  const toolCount = isLoading || isError ? null : tools.length;

  useEffect(() => {
    if (!projectId || toolCount == null) {
      tabBadgeUpdater("tools", null);
      return () => {
        tabBadgeUpdater("tools", null);
      };
    }
    tabBadgeUpdater("tools", toolCount);
    return () => {
      tabBadgeUpdater("tools", null);
    };
  }, [toolCount, projectId, tabBadgeUpdater]);

  const buildInitialValues = useCallback((tool: ToolEntry) => {
    const description =
      typeof tool.data.description === "string" ? tool.data.description : undefined;
    const version = typeof tool.data.version === "string" ? tool.data.version : undefined;
    const type = typeof tool.data.type === "string" ? tool.data.type : undefined;

    return {
      name: tool.name,
      ...(description ? { description } : {}),
      ...(version ? { version } : {}),
      ...(type ? { type } : {}),
    } as Record<string, FieldValue>;
  }, []);

  return (
    <GenericEntityReport
      title="Tools"
      description="CLI tools, build tools, and utilities in your project."
      icon={Terminal}
      entityType="tool"
      projectId={projectId}
      items={tools}
      optionCatalog={uiOptionCatalog}
      emptyMessage="No tools found yet. Add one to track your CLI and build utilities."
      isLoading={isLoading}
      isError={isError}
      errorMessage={
        error instanceof Error ? error.message : "Unable to load tools for this project."
      }
      className={className ?? ""}
      refresh={refreshResolved}
      buildInitialValues={buildInitialValues}
      renderCard={(tool, { openEdit }) => (
        <ArtifactCard
          key={tool.key}
          name={tool.name}
          data={tool.data}
          onClick={() => openEdit(tool)}
        />
      )}
      successMessages={{ create: "Tool added successfully", edit: "Tool updated successfully" }}
    />
  );
};

export default ToolsReport;
