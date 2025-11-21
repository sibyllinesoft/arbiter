import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { FileCode } from "lucide-react";
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

interface SchemasReportProps {
  projectId: string;
  className?: string;
}

export const SchemasReport: React.FC<SchemasReportProps> = ({ projectId, className }) => {
  const { data, isLoading, isError, error } = useResolvedSpec(projectId);
  const queryClient = useQueryClient();
  const [isAddSchemaOpen, setIsAddSchemaOpen] = useState(false);
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

  const handleOpenAddSchema = useCallback(() => {
    setIsAddSchemaOpen(true);
  }, []);

  const handleCloseAddSchema = useCallback(() => {
    if (isCreating) return;
    setIsAddSchemaOpen(false);
  }, [isCreating]);

  const handleSubmitAddSchema = useCallback(
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
        toast.success("Schema added successfully");
        setIsAddSchemaOpen(false);
      }
    },
    [projectId, isCreating, persistEntity],
  );

  const schemas = useMemo(() => {
    const resolved = data?.resolved as Record<string, any> | undefined;
    const spec = resolved?.spec ?? resolved;
    const schemasSource = spec?.schemas ?? resolved?.schemas ?? [];

    const entries: Array<{ key: string; name: string; data: any }> = [];
    if (Array.isArray(schemasSource)) {
      schemasSource.forEach((schema, index) => {
        const name =
          typeof schema === "string"
            ? schema
            : (schema?.name ?? schema?.id ?? `schema-${index + 1}`);
        const data = typeof schema === "string" ? { name: schema } : schema;
        entries.push({ key: `schema-${index}`, name, data });
      });
    } else if (schemasSource && typeof schemasSource === "object") {
      Object.entries(schemasSource).forEach(([key, value]) => {
        const name = typeof value === "string" ? value : ((value as any)?.name ?? key);
        const data = typeof value === "string" ? { name: value } : value;
        entries.push({ key, name, data });
      });
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.resolved]);

  const tabBadgeUpdater = useTabBadgeUpdater();
  const schemaCount = isLoading || isError ? null : schemas.length;

  useEffect(() => {
    if (!projectId || schemaCount == null) {
      tabBadgeUpdater("schemas", null);
      return () => {
        tabBadgeUpdater("schemas", null);
      };
    }
    tabBadgeUpdater("schemas", schemaCount);
    return () => {
      tabBadgeUpdater("schemas", null);
    };
  }, [schemaCount, projectId, tabBadgeUpdater]);

  return (
    <>
      <div className={clsx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-gray-600 dark:text-graphite-300">
              Loading schemas...
            </div>
          ) : isError ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-rose-600 dark:text-rose-400">
              {error instanceof Error ? error.message : "Unable to load schemas for this project."}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              <EntityCatalog
                title="Schemas"
                description="Data structures for requests, responses, entities, values, and events."
                icon={FileCode}
                items={schemas}
                isLoading={isLoading}
                emptyMessage="No schemas found yet. Add one to define your data structures."
                addAction={{
                  label: "Add Schema",
                  onAdd: handleOpenAddSchema,
                  disabled: !projectId || isCreating,
                  loading: isCreating,
                }}
                renderCard={(schema) => (
                  <ArtifactCard
                    key={schema.key}
                    name={schema.name}
                    data={schema.data}
                    onClick={() => {}}
                  />
                )}
              />
            </div>
          )}
        </div>
      </div>

      <AddEntityModal
        open={isAddSchemaOpen}
        entityType="schema"
        groupLabel="Schemas"
        optionCatalog={uiOptionCatalog}
        onClose={handleCloseAddSchema}
        mode="create"
        onSubmit={handleSubmitAddSchema}
      />
    </>
  );
};

export default SchemasReport;
