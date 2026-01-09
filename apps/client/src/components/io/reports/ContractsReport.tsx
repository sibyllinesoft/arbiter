import { useQueryClient } from "@tanstack/react-query";
import { FileSignature } from "lucide-react";
import React, { useCallback, useEffect, useMemo } from "react";

import { GenericEntityReport } from "@/components/templates/GenericEntityReport";
import { useTabBadgeUpdater } from "@/contexts/TabBadgeContext";
import { useResolvedSpec, useUiOptionCatalog } from "@/hooks/api-hooks";
import ArtifactCard from "../../core/ArtifactCard";
import { DEFAULT_UI_OPTION_CATALOG, type UiOptionCatalog } from "../../modals/entityTypes";

interface ContractsReportProps {
  projectId: string;
  className?: string;
}

export const ContractsReport: React.FC<ContractsReportProps> = ({ projectId, className }) => {
  const { data, isLoading, isError, error } = useResolvedSpec(projectId);
  const queryClient = useQueryClient();
  const { data: uiOptionCatalogData } = useUiOptionCatalog();
  const uiOptionCatalog = useMemo<UiOptionCatalog>(
    () => ({ ...DEFAULT_UI_OPTION_CATALOG, ...(uiOptionCatalogData ?? {}) }),
    [uiOptionCatalogData],
  );

  type ContractEntry = { key: string; name: string; data: Record<string, unknown> };

  const contracts = useMemo<ContractEntry[]>(() => {
    const resolved = (data?.resolved as Record<string, unknown> | undefined) ?? {};
    const spec = (resolved as any).spec ?? resolved;
    const contractsSource = (spec as any).contracts ?? (resolved as any).contracts ?? [];

    const entries: ContractEntry[] = [];
    if (Array.isArray(contractsSource)) {
      contractsSource.forEach((contract, index) => {
        const name =
          typeof contract === "string"
            ? contract
            : (contract?.name ?? contract?.id ?? `contract-${index + 1}`);
        const data =
          typeof contract === "string"
            ? { name: contract }
            : ((contract as Record<string, unknown>) ?? {});
        entries.push({ key: `contract-${index}`, name, data });
      });
    } else if (contractsSource && typeof contractsSource === "object") {
      Object.entries(contractsSource as Record<string, unknown>).forEach(([key, value]) => {
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
  const contractCount = isLoading || isError ? null : contracts.length;

  const refreshResolved = useCallback(async () => {
    if (!projectId) return;
    await queryClient.invalidateQueries({ queryKey: ["resolved-spec", projectId] });
    await queryClient.refetchQueries({
      queryKey: ["resolved-spec", projectId],
      type: "active",
    });
  }, [projectId, queryClient]);

  useEffect(() => {
    if (!projectId || contractCount == null) {
      tabBadgeUpdater("contracts", null);
      return () => {
        tabBadgeUpdater("contracts", null);
      };
    }
    tabBadgeUpdater("contracts", contractCount);
    return () => {
      tabBadgeUpdater("contracts", null);
    };
  }, [contractCount, projectId, tabBadgeUpdater]);

  return (
    <GenericEntityReport
      title="Contracts"
      description="API contracts defining operations, schemas, and service-level agreements."
      icon={FileSignature}
      entityType="contract"
      projectId={projectId}
      items={contracts}
      optionCatalog={uiOptionCatalog}
      emptyMessage="No contracts found yet. Add one to define your API contracts."
      isLoading={isLoading}
      isError={isError}
      errorMessage={
        error instanceof Error ? error.message : "Unable to load contracts for this project."
      }
      className={className ?? ""}
      refresh={refreshResolved}
      buildInitialValues={(item) => {
        const rawDescription =
          typeof item.data === "object" && item.data && "description" in item.data
            ? (item.data as Record<string, unknown>).description
            : undefined;
        const description = typeof rawDescription === "string" ? rawDescription : undefined;
        return {
          name: item.name,
          ...(description ? { description } : {}),
        };
      }}
      renderCard={(contract, { openEdit }) => (
        <ArtifactCard
          key={contract.key}
          name={contract.name}
          data={contract.data}
          onClick={() => openEdit(contract)}
        />
      )}
      successMessages={{
        create: "Contract added successfully",
        edit: "Contract updated successfully",
      }}
    />
  );
};

export default ContractsReport;
