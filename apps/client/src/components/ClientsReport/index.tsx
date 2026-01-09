/**
 * @module ClientsReport
 * Component for displaying and managing client entities in a project.
 * Provides CRUD operations for clients and their associated views.
 */
import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Layout } from "lucide-react";
import React, { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { useTabBadgeUpdater } from "@/contexts/TabBadgeContext";
import { Button } from "@/design-system";
import { slugify } from "@/features/spec/utils/clients";
import { useCatalog } from "@/hooks/useCatalog";
import { apiService } from "@/services/api";
import type { ResolvedSpecResponse } from "@/types/api";
import ArtifactCard from "../core/ArtifactCard";
import AddEntityModal from "../modals/AddEntityModal";
import { type FieldValue, type UiOptionCatalog } from "../modals/entityTypes";
import { ClientCard } from "./components/ClientCard";
import type { ClientsReportProps, NormalizedClient } from "./types";
import { extractClients } from "./utils/extractClients";

/** No-op function for default handlers */
const noop = () => {};

/** Toast configuration for success messages */
const TOAST_SUCCESS_CONFIG = {
  icon: false,
  className: "graphite-toast-success",
  progressClassName: "graphite-toast-progress-success",
} as const;

/** Toast configuration for error messages */
const TOAST_ERROR_CONFIG = {
  className: "graphite-toast-error",
  progressClassName: "graphite-toast-progress-error",
} as const;

/** Extract name value from form values */
function extractNameValue(values: Record<string, FieldValue>, fallback: string): string {
  const name = values.name;
  return typeof name === "string" && name.trim().length > 0 ? name.trim() : fallback;
}

/** Create normalized values with identifiers */
function buildValuesWithIdentifiers(
  values: Record<string, FieldValue>,
  identifier: string,
): Record<string, unknown> {
  const valuesWithIds: Record<string, FieldValue> = {
    ...values,
    id: identifier,
    slug: identifier,
  };
  return Object.fromEntries(
    Object.entries(valuesWithIds).map(([key, value]) => [key, value as unknown]),
  );
}

/** Extract path value from form values */
function extractPathValue(values: Record<string, FieldValue>, fallback: string): string {
  const path = values.path;
  return typeof path === "string" && path.trim().length > 0 ? path.trim() : fallback;
}

/** Build view values with client context */
function buildViewValuesWithContext(
  values: Record<string, FieldValue>,
  identifier: string,
  client: NormalizedClient,
): Record<string, unknown> {
  const valuesWithContext: Record<string, FieldValue> = {
    ...values,
    id: identifier,
    slug: identifier,
    clientId: client.identifier,
    clientIdentifier: client.identifier,
    clientName: client.displayName ?? client.identifier,
    clientSlug: slugify(client.identifier),
  };
  return Object.fromEntries(
    Object.entries(valuesWithContext).map(([key, value]) => [key, value as unknown]),
  );
}

/**
 * ClientsReport displays a list of client applications with their views.
 * Supports creating new clients and adding views to existing clients.
 * @param props - Component props
 * @param props.projectId - ID of the current project
 * @param props.className - Optional CSS class name
 */
export const ClientsReport: FC<ClientsReportProps> = ({ projectId, className }) => {
  const catalog = useCatalog<ResolvedSpecResponse>(projectId);
  const { data, isLoading, isError, error } = catalog;
  const queryClient = useQueryClient();
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const uiOptionCatalog = useMemo<UiOptionCatalog>(
    () => catalog.uiOptionCatalog,
    [catalog.uiOptionCatalog],
  );
  const [addViewState, setAddViewState] = useState<{
    open: boolean;
    client: NormalizedClient | null;
  }>({
    open: false,
    client: null,
  });
  const [isCreatingView, setIsCreatingView] = useState(false);

  const refreshResolved = useCallback(
    async (options: { silent?: boolean } = {}) => {
      await catalog.refresh(options);
    },
    [catalog],
  );

  const handleOpenAddClient = useCallback(() => {
    setIsAddClientOpen(true);
  }, []);

  const handleCloseAddClient = useCallback(() => {
    if (isCreatingClient) return;
    setIsAddClientOpen(false);
  }, [isCreatingClient]);

  const handleSubmitAddClient = useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      if (!projectId || isCreatingClient) return;

      setIsCreatingClient(true);
      try {
        const nameValue = extractNameValue(payload.values, `frontend-${Date.now()}`);
        const draftIdentifier = slugify(nameValue);
        const normalizedValues = buildValuesWithIdentifiers(payload.values, draftIdentifier);

        await apiService.createProjectEntity(projectId, {
          type: payload.entityType,
          values: normalizedValues,
        });
        await refreshResolved();
        await queryClient.invalidateQueries({ queryKey: ["projects"] });
        await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
        toast.success("Client added successfully", TOAST_SUCCESS_CONFIG);
        setIsAddClientOpen(false);
      } catch (submissionError) {
        console.error("[ClientsReport] Failed to add client", submissionError);
        const message =
          submissionError instanceof Error ? submissionError.message : "Failed to add client";
        toast.error(message, TOAST_ERROR_CONFIG);
      } finally {
        setIsCreatingClient(false);
      }
    },
    [projectId, isCreatingClient, refreshResolved, queryClient],
  );

  const handleOpenAddView = useCallback((client: NormalizedClient) => {
    setAddViewState({ open: true, client });
  }, []);

  const handleCloseAddView = useCallback(() => {
    if (isCreatingView) return;
    setAddViewState({ open: false, client: null });
  }, [isCreatingView]);

  const handleSubmitAddView = useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      if (!projectId || !addViewState.client || isCreatingView) return;

      const targetClient = addViewState.client;
      setIsCreatingView(true);
      try {
        const nameValue = extractNameValue(
          payload.values,
          targetClient.displayName ?? targetClient.identifier,
        );
        const pathValue = extractPathValue(payload.values, "/");
        const draftIdentifier = slugify(`${nameValue}-${pathValue || "view"}`);
        const normalizedValues = buildViewValuesWithContext(
          payload.values,
          draftIdentifier,
          targetClient,
        );

        await apiService.createProjectEntity(projectId, {
          type: payload.entityType,
          values: normalizedValues,
        });
        await refreshResolved();
        await queryClient.invalidateQueries({ queryKey: ["projects"] });
        await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
        toast.success("View added successfully", TOAST_SUCCESS_CONFIG);
        setAddViewState({ open: false, client: null });
      } catch (submissionError) {
        console.error("[ClientsReport] Failed to add view", submissionError);
        const message =
          submissionError instanceof Error ? submissionError.message : "Failed to add view";
        toast.error(message, TOAST_ERROR_CONFIG);
      } finally {
        setIsCreatingView(false);
      }
    },
    [projectId, addViewState.client, isCreatingView, refreshResolved, queryClient],
  );

  const { internalClients, externalClients } = useMemo(() => {
    const resolved = (data?.resolved as Record<string, unknown> | undefined) ?? {};
    return extractClients(resolved);
  }, [data?.resolved]);

  const tabBadgeUpdater = useTabBadgeUpdater();
  const resolvedProject = (data?.resolved as { project?: { entities?: Record<string, unknown> } })
    ?.project;
  const resolvedEntities = resolvedProject?.entities as Record<string, unknown> | undefined;
  const resolvedClientCount =
    typeof resolvedEntities?.["frontends"] === "number"
      ? (resolvedEntities["frontends"] as number)
      : null;
  const clientCount = isLoading || isError ? null : (resolvedClientCount ?? internalClients.length);

  useEffect(() => {
    if (!projectId) {
      tabBadgeUpdater("clients", null);
      return () => {
        tabBadgeUpdater("clients", null);
      };
    }
    if (clientCount == null) {
      tabBadgeUpdater("clients", null);
      return () => {
        tabBadgeUpdater("clients", null);
      };
    }
    tabBadgeUpdater("clients", clientCount);
    return () => {
      tabBadgeUpdater("clients", null);
    };
  }, [clientCount, projectId, tabBadgeUpdater]);

  return (
    <>
      <div className={clsx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-gray-600 dark:text-graphite-300">
              Loading clients...
            </div>
          ) : isError ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-rose-600 dark:text-rose-400">
              {error instanceof Error ? error.message : "Unable to load clients for this project."}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              <div className="border-b border-graphite-200/60 bg-gray-100 px-6 py-6 dark:border-graphite-700/60 dark:bg-graphite-900/70">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center text-blue-600 dark:text-blue-200">
                      <Layout className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25">
                        Client Experiences
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-graphite-300">
                        Explore detected frontends and add new experiences to your project catalog.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleOpenAddClient}
                    disabled={!projectId || isCreatingClient}
                    loading={isCreatingClient}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors",
                      "hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                      "disabled:cursor-not-allowed disabled:bg-blue-400 disabled:text-blue-100",
                    )}
                  >
                    Add Client
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-transparent">
                <div className="space-y-6">
                  {internalClients.length > 0 ? (
                    <div className="overflow-hidden font-medium">
                      <div className="grid gap-3 grid-cols-1">
                        {internalClients.map((client) => (
                          <ClientCard
                            key={client.key}
                            client={client}
                            onAddView={handleOpenAddView}
                            disableAddView={isCreatingView || addViewState.open}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-graphite-300">
                      No code-backed clients found yet. Add one manually or ingest more sources.
                    </p>
                  )}

                  {externalClients.length > 0 && (
                    <div className="overflow-hidden font-medium rounded-lg border border-graphite-200/60 dark:border-graphite-700/60">
                      <div className="border-b border-graphite-200/60 bg-gray-100 px-4 py-3 dark:border-graphite-700/60 dark:bg-graphite-900/70">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-900/70 dark:text-graphite-50/70">
                            <Layout className="h-4 w-4" />
                            <span>External Clients</span>
                          </div>
                          <span className="text-xs text-gray-500/70 dark:text-graphite-300/70">
                            {externalClients.length}
                          </span>
                        </div>
                      </div>
                      <div className="px-3 py-3 md:px-4 md:py-4">
                        <div className="grid gap-3 grid-cols-1">
                          {externalClients.map((card) => (
                            <ArtifactCard
                              key={card.key}
                              name={card.name}
                              data={card.data}
                              onClick={noop}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AddEntityModal
        open={isAddClientOpen}
        entityType="frontend"
        groupLabel="Clients"
        optionCatalog={uiOptionCatalog}
        onClose={handleCloseAddClient}
        mode="create"
        onSubmit={handleSubmitAddClient}
      />
      {addViewState.open && addViewState.client && (
        <AddEntityModal
          open={addViewState.open}
          entityType="view"
          groupLabel="Views"
          optionCatalog={uiOptionCatalog}
          onClose={handleCloseAddView}
          mode="create"
          titleOverride={`Add view for ${addViewState.client.displayName || addViewState.client.identifier}`}
          descriptionOverride="Define the route path and optional metadata for this client view."
          onSubmit={handleSubmitAddView}
        />
      )}
    </>
  );
};

export default ClientsReport;
