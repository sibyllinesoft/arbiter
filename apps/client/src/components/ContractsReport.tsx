import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { FileSignature } from "lucide-react";
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

interface ContractsReportProps {
  projectId: string;
  className?: string;
}

export const ContractsReport: React.FC<ContractsReportProps> = ({ projectId, className }) => {
  const { data, isLoading, isError, error } = useResolvedSpec(projectId);
  const queryClient = useQueryClient();
  const [isAddContractOpen, setIsAddContractOpen] = useState(false);
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

  const handleOpenAddContract = useCallback(() => {
    setIsAddContractOpen(true);
  }, []);

  const handleCloseAddContract = useCallback(() => {
    if (isCreating) return;
    setIsAddContractOpen(false);
  }, [isCreating]);

  const handleSubmitAddContract = useCallback(
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
        toast.success("Contract added successfully");
        setIsAddContractOpen(false);
      }
    },
    [projectId, isCreating, persistEntity],
  );

  const contracts = useMemo(() => {
    const resolved = data?.resolved as Record<string, any> | undefined;
    const spec = resolved?.spec ?? resolved;
    const contractsSource = spec?.contracts ?? resolved?.contracts ?? [];

    const entries: Array<{ key: string; name: string; data: any }> = [];
    if (Array.isArray(contractsSource)) {
      contractsSource.forEach((contract, index) => {
        const name =
          typeof contract === "string"
            ? contract
            : (contract?.name ?? contract?.id ?? `contract-${index + 1}`);
        const data = typeof contract === "string" ? { name: contract } : contract;
        entries.push({ key: `contract-${index}`, name, data });
      });
    } else if (contractsSource && typeof contractsSource === "object") {
      Object.entries(contractsSource).forEach(([key, value]) => {
        const name = typeof value === "string" ? value : ((value as any)?.name ?? key);
        const data = typeof value === "string" ? { name: value } : value;
        entries.push({ key, name, data });
      });
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.resolved]);

  const tabBadgeUpdater = useTabBadgeUpdater();
  const contractCount = isLoading || isError ? null : contracts.length;

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
    <>
      <div className={clsx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-gray-600 dark:text-graphite-300">
              Loading contracts...
            </div>
          ) : isError ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-rose-600 dark:text-rose-400">
              {error instanceof Error
                ? error.message
                : "Unable to load contracts for this project."}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              <EntityCatalog
                title="Contracts"
                description="API contracts defining operations, schemas, and service-level agreements."
                icon={FileSignature}
                items={contracts}
                isLoading={isLoading}
                emptyMessage="No contracts found yet. Add one to define your API contracts."
                addAction={{
                  label: "Add Contract",
                  onAdd: handleOpenAddContract,
                  disabled: !projectId || isCreating,
                  loading: isCreating,
                }}
                renderCard={(contract) => (
                  <ArtifactCard
                    key={contract.key}
                    name={contract.name}
                    data={contract.data}
                    onClick={() => {}}
                  />
                )}
              />
            </div>
          )}
        </div>
      </div>

      <AddEntityModal
        open={isAddContractOpen}
        entityType="contract"
        groupLabel="Contracts"
        optionCatalog={uiOptionCatalog}
        onClose={handleCloseAddContract}
        mode="create"
        onSubmit={handleSubmitAddContract}
      />
    </>
  );
};

export default ContractsReport;
