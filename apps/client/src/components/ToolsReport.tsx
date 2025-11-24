import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Terminal } from "lucide-react";
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

interface ToolsReportProps {
  projectId: string;
  className?: string;
}

export const ToolsReport: React.FC<ToolsReportProps> = ({ projectId, className }) => {
  const { data, isLoading, isError, error } = useResolvedSpec(projectId);
  const queryClient = useQueryClient();
  const [isAddToolOpen, setIsAddToolOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editToolState, setEditToolState] = useState<{
    open: boolean;
    tool: { key: string; name: string; data: any } | null;
    initialValues?: Record<string, FieldValue>;
  }>({ open: false, tool: null });
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

  const handleOpenAddTool = useCallback(() => {
    setIsAddToolOpen(true);
  }, []);

  const handleCloseAddTool = useCallback(() => {
    if (isCreating) return;
    setIsAddToolOpen(false);
  }, [isCreating]);

  const handleSubmitAddTool = useCallback(
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
        toast.success("Tool added successfully");
        setIsAddToolOpen(false);
      }
    },
    [projectId, isCreating, persistEntity],
  );

  const handleOpenEditTool = useCallback((tool: { key: string; name: string; data: any }) => {
    const initialValues: Record<string, FieldValue> = {
      name: tool.name,
      ...(tool.data?.description ? { description: tool.data.description } : {}),
      ...(tool.data?.version ? { version: tool.data.version } : {}),
      ...(tool.data?.type ? { type: tool.data.type } : {}),
    };
    setEditToolState({
      open: true,
      tool,
      initialValues,
    });
  }, []);

  const handleCloseEditTool = useCallback(() => {
    setEditToolState({ open: false, tool: null });
  }, []);

  const handleSubmitEditTool = useCallback(
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
        toast.success("Tool updated successfully");
        setEditToolState({ open: false, tool: null });
      }
    },
    [projectId, isCreating, persistEntity],
  );

  const tools = useMemo(() => {
    const resolved = data?.resolved as Record<string, any> | undefined;
    const spec = resolved?.spec ?? resolved;
    const componentsSource = spec?.components ?? resolved?.components ?? {};

    // DEBUG: Log components data
    console.log("=== TOOLS DEBUG DUMP ===", {
      hasResolved: Boolean(resolved),
      hasSpec: Boolean(spec),
      hasComponents: Boolean(componentsSource),
      componentsType: Array.isArray(componentsSource) ? "array" : typeof componentsSource,
      componentsKeys: typeof componentsSource === "object" ? Object.keys(componentsSource) : [],
      componentsCount: Array.isArray(componentsSource)
        ? componentsSource.length
        : typeof componentsSource === "object"
          ? Object.keys(componentsSource).length
          : 0,
      fullComponents: componentsSource,
    });

    const entries: Array<{ key: string; name: string; data: any }> = [];
    if (Array.isArray(componentsSource)) {
      componentsSource.forEach((comp, index) => {
        const type = comp?.type?.toString().toLowerCase() ?? "";
        const detectedType = comp?.metadata?.detectedType?.toString().toLowerCase() ?? "";
        if (
          type === "tool" ||
          type === "cli" ||
          type === "binary" ||
          detectedType === "tool" ||
          detectedType === "build_tool"
        ) {
          const name = comp?.name ?? `tool-${index + 1}`;
          entries.push({ key: `tool-${index}`, name, data: comp });
        }
      });
    } else if (componentsSource && typeof componentsSource === "object") {
      Object.entries(componentsSource).forEach(([key, value]) => {
        const type = (value as any)?.type?.toString().toLowerCase() ?? "";
        const detectedType = (value as any)?.metadata?.detectedType?.toString().toLowerCase() ?? "";
        if (
          type === "tool" ||
          type === "cli" ||
          type === "binary" ||
          detectedType === "tool" ||
          detectedType === "build_tool"
        ) {
          const name = (value as any)?.name ?? key;
          entries.push({ key, name, data: value });
        }
      });
    }

    const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));

    // DEBUG: Log filtered tools
    console.log("=== FILTERED TOOLS ===", {
      totalFiltered: sorted.length,
      tools: sorted.map((t) => ({
        key: t.key,
        name: t.name,
        type: t.data?.type,
        detectedType: t.data?.metadata?.detectedType,
      })),
      uniqueKeys: new Set(sorted.map((t) => t.key)).size,
      duplicateKeys: sorted.length !== new Set(sorted.map((t) => t.key)).size,
    });

    return sorted;
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

  return (
    <>
      <div className={clsx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-gray-600 dark:text-graphite-300">
              Loading tools...
            </div>
          ) : isError ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-rose-600 dark:text-rose-400">
              {error instanceof Error ? error.message : "Unable to load tools for this project."}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              <EntityCatalog
                title="Tools"
                description="CLI tools, build tools, and utilities in your project."
                icon={Terminal}
                items={tools}
                isLoading={isLoading}
                emptyMessage="No tools found yet. Add one to track your CLI and build utilities."
                addAction={{
                  label: "Add Tool",
                  onAdd: handleOpenAddTool,
                  disabled: !projectId || isCreating,
                  loading: isCreating,
                }}
                renderCard={(tool) => (
                  <ArtifactCard
                    key={tool.key}
                    name={tool.name}
                    data={tool.data}
                    onClick={() => handleOpenEditTool(tool)}
                  />
                )}
              />
            </div>
          )}
        </div>
      </div>

      <AddEntityModal
        open={isAddToolOpen}
        entityType="tool"
        groupLabel="Tools"
        optionCatalog={uiOptionCatalog}
        onClose={handleCloseAddTool}
        mode="create"
        onSubmit={handleSubmitAddTool}
      />

      {editToolState.open && (
        <AddEntityModal
          open={editToolState.open}
          entityType="tool"
          groupLabel="Tools"
          optionCatalog={uiOptionCatalog}
          onClose={handleCloseEditTool}
          mode="edit"
          initialValues={editToolState.initialValues}
          titleOverride={editToolState.tool ? `Update ${editToolState.tool.name}` : "Update Tool"}
          onSubmit={handleSubmitEditTool}
        />
      )}
    </>
  );
};

export default ToolsReport;
