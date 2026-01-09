import { useQueryClient } from "@tanstack/react-query";
import { FileCode } from "lucide-react";
import React, { useCallback, useEffect, useMemo } from "react";

import { GenericEntityReport } from "@/components/templates/GenericEntityReport";
import { useTabBadgeUpdater } from "@/contexts/TabBadgeContext";
import { useResolvedSpec, useUiOptionCatalog } from "@/hooks/api-hooks";
import ArtifactCard from "../core/ArtifactCard";
import { DEFAULT_UI_OPTION_CATALOG, type UiOptionCatalog } from "../modals/entityTypes";

interface SchemasReportProps {
  projectId: string;
  className?: string;
}

export const SchemasReport: React.FC<SchemasReportProps> = ({ projectId, className }) => {
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

  type SchemaEntry = { key: string; name: string; data: Record<string, unknown> };

  const schemas = useMemo<SchemaEntry[]>(() => {
    const resolved = (data?.resolved as Record<string, unknown> | undefined) ?? {};
    const spec = ((resolved as any).spec ?? resolved) as Record<string, unknown>;
    const schemasSource = (spec as any).schemas ?? (resolved as any).schemas ?? [];

    const entries: SchemaEntry[] = [];
    if (Array.isArray(schemasSource)) {
      schemasSource.forEach((schema, index) => {
        const name =
          typeof schema === "string"
            ? schema
            : (schema?.name ?? schema?.id ?? `schema-${index + 1}`);
        const data =
          typeof schema === "string"
            ? { name: schema }
            : ((schema as Record<string, unknown>) ?? {});
        entries.push({ key: `schema-${index}`, name, data });
      });
    } else if (schemasSource && typeof schemasSource === "object") {
      Object.entries(schemasSource as Record<string, unknown>).forEach(([key, value]) => {
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
    <GenericEntityReport
      title="Schemas"
      description="Data structures for requests, responses, entities, values, and events."
      icon={FileCode}
      entityType="schema"
      projectId={projectId}
      items={schemas}
      optionCatalog={uiOptionCatalog}
      emptyMessage="No schemas found yet. Add one to define your data structures."
      isLoading={isLoading}
      isError={isError}
      errorMessage={
        error instanceof Error ? error.message : "Unable to load schemas for this project."
      }
      className={className ?? ""}
      refresh={refreshResolved}
      buildInitialValues={(schema) => {
        const rawDescription =
          typeof schema.data === "object" && schema.data && "description" in schema.data
            ? (schema.data as Record<string, unknown>).description
            : undefined;
        const description = typeof rawDescription === "string" ? rawDescription : undefined;
        return {
          name: schema.name,
          ...(description ? { description } : {}),
        };
      }}
      renderCard={(schema, { openEdit }) => (
        <ArtifactCard
          key={schema.key}
          name={schema.name}
          data={schema.data}
          onClick={() => openEdit(schema)}
        />
      )}
      successMessages={{ create: "Schema added successfully", edit: "Schema updated successfully" }}
    />
  );
};

export default SchemasReport;
