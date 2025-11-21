import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Layout } from "lucide-react";
import React, { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { useTabBadgeUpdater } from "@/contexts/TabBadgeContext";
import { useResolvedSpec, useUiOptionCatalog } from "@/hooks/api-hooks";
import { apiService } from "@/services/api";
import ArtifactCard from "../ArtifactCard";
import AddEntityModal from "../modals/AddEntityModal";
import {
  DEFAULT_UI_OPTION_CATALOG,
  type FieldValue,
  type UiOptionCatalog,
} from "../modals/entityTypes";
import { EntityCatalog } from "../templates/EntityCatalog";
import { ClientCard } from "./components/ClientCard";
import { createExternalArtifactCard, isManualClient, normalizeClient } from "./normalizers";
import type { ClientsReportProps, NormalizedClient, NormalizedClientView } from "./types";
import { coerceDisplayValue, slugify } from "./utils";

const noop = () => {};

export const ClientsReport: FC<ClientsReportProps> = ({ projectId, className }) => {
  const { data, isLoading, isError, error } = useResolvedSpec(projectId);
  const queryClient = useQueryClient();
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const { data: uiOptionCatalogData } = useUiOptionCatalog();
  const uiOptionCatalog = useMemo<UiOptionCatalog>(
    () => ({ ...DEFAULT_UI_OPTION_CATALOG, ...(uiOptionCatalogData ?? {}) }),
    [uiOptionCatalogData],
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

  const handleOpenAddClient = useCallback(() => {
    setIsAddClientOpen(true);
  }, []);

  const handleCloseAddClient = useCallback(() => {
    if (isCreatingClient) return;
    setIsAddClientOpen(false);
  }, [isCreatingClient]);

  const handleSubmitAddClient = useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      if (!projectId || isCreatingClient) {
        return;
      }

      try {
        setIsCreatingClient(true);
        const nameValue =
          typeof payload.values.name === "string" && payload.values.name.trim().length > 0
            ? payload.values.name.trim()
            : "";
        const draftIdentifier = slugify(nameValue || `frontend-${Date.now()}`);
        const valuesWithIdentifiers: Record<string, FieldValue> = {
          ...payload.values,
          id: draftIdentifier,
          slug: draftIdentifier,
        };
        const normalizedValues = Object.fromEntries(
          Object.entries(valuesWithIdentifiers).map(([key, value]) => [key, value as unknown]),
        );
        await apiService.createProjectEntity(projectId, {
          type: payload.entityType,
          values: normalizedValues,
        });
        await refreshResolved();
        await queryClient.invalidateQueries({ queryKey: ["projects"] });
        await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
        toast.success("Client added successfully", {
          icon: false,
          className: "graphite-toast-success",
          progressClassName: "graphite-toast-progress-success",
        });
        setIsAddClientOpen(false);
      } catch (submissionError) {
        console.error("[ClientsReport] Failed to add client", submissionError);
        const message =
          submissionError instanceof Error ? submissionError.message : "Failed to add client";
        toast.error(message, {
          className: "graphite-toast-error",
          progressClassName: "graphite-toast-progress-error",
        });
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
      if (!projectId || !addViewState.client || isCreatingView) {
        return;
      }

      try {
        setIsCreatingView(true);
        const targetClient = addViewState.client;
        const nameValue =
          typeof payload.values.name === "string" && payload.values.name.trim().length > 0
            ? payload.values.name.trim()
            : (targetClient.displayName ?? targetClient.identifier);
        const pathValue =
          typeof payload.values.path === "string" && payload.values.path.trim().length > 0
            ? payload.values.path.trim()
            : "/";
        const draftIdentifier = slugify(
          `${nameValue || targetClient.identifier}-${pathValue || "view"}`,
        );
        const valuesWithContext: Record<string, FieldValue> = {
          ...payload.values,
          id: draftIdentifier,
          slug: draftIdentifier,
          clientId: targetClient.identifier,
          clientIdentifier: targetClient.identifier,
          clientName: targetClient.displayName ?? targetClient.identifier,
          clientSlug: slugify(targetClient.identifier),
        };

        const normalizedValues = Object.fromEntries(
          Object.entries(valuesWithContext).map(([key, value]) => [key, value as unknown]),
        );

        await apiService.createProjectEntity(projectId, {
          type: payload.entityType,
          values: normalizedValues,
        });

        await refreshResolved();
        await queryClient.invalidateQueries({ queryKey: ["projects"] });
        await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });

        toast.success("View added successfully", {
          icon: false,
          className: "graphite-toast-success",
          progressClassName: "graphite-toast-progress-success",
        });
        setAddViewState({ open: false, client: null });
      } catch (submissionError) {
        console.error("[ClientsReport] Failed to add view", submissionError);
        const message =
          submissionError instanceof Error ? submissionError.message : "Failed to add view";
        toast.error(message, {
          className: "graphite-toast-error",
          progressClassName: "graphite-toast-progress-error",
        });
      } finally {
        setIsCreatingView(false);
      }
    },
    [projectId, addViewState.client, isCreatingView, refreshResolved, queryClient],
  );

  const { internalClients, externalClients } = useMemo(() => {
    const resolved = data?.resolved as Record<string, any> | undefined;
    const spec = resolved?.spec ?? resolved;
    const componentsSource = spec?.components ?? resolved?.components ?? {};

    const entries: Array<[string, any]> = [];
    if (Array.isArray(componentsSource)) {
      componentsSource.forEach((component, index) => {
        entries.push([`component-${index + 1}`, component]);
      });
    } else if (componentsSource && typeof componentsSource === "object") {
      Object.entries(componentsSource).forEach(([key, value]) => {
        entries.push([key, value]);
      });
    }

    const seenComponentKeys = new Set(entries.map(([key]) => key.toLowerCase()));

    const frontendPackages = Array.isArray(spec?.frontend?.packages) ? spec.frontend.packages : [];

    frontendPackages.forEach((pkg: Record<string, unknown>) => {
      if (!pkg || typeof pkg !== "object") return;
      const packageNameRaw =
        (typeof (pkg as Record<string, unknown>).packageName === "string"
          ? ((pkg as Record<string, string>).packageName ?? "").trim()
          : "") ||
        (typeof (pkg as Record<string, unknown>).name === "string"
          ? ((pkg as Record<string, string>).name ?? "").trim()
          : "");
      if (!packageNameRaw) return;
      const key = packageNameRaw.replace(/_/g, "-");
      const normalizedKey = key.toLowerCase();
      if (seenComponentKeys.has(normalizedKey)) {
        return;
      }

      const packageRoot =
        typeof (pkg as Record<string, unknown>).packageRoot === "string"
          ? ((pkg as Record<string, string>).packageRoot ?? "").trim()
          : undefined;
      const packageJsonPath =
        typeof (pkg as Record<string, unknown>).packageJsonPath === "string"
          ? ((pkg as Record<string, string>).packageJsonPath ?? "").trim()
          : undefined;
      const frameworks = Array.isArray((pkg as Record<string, unknown>).frameworks)
        ? ((pkg as { frameworks: unknown[] }).frameworks ?? [])
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
        : [];
      const routeEntries = Array.isArray((pkg as Record<string, unknown>).routes)
        ? ((pkg as { routes: any[] }).routes ?? [])
            .map((route) => {
              if (!route || typeof route !== "object") return null;
              const pathValue = typeof route.path === "string" ? route.path.trim() : "";
              const filePathValue = typeof route.filePath === "string" ? route.filePath.trim() : "";
              const routerTypeValue =
                typeof route.routerType === "string" ? route.routerType.trim() : undefined;
              if (!pathValue && !filePathValue) return null;
              return {
                path: pathValue || "/",
                ...(filePathValue ? { filePath: filePathValue } : {}),
                ...(routerTypeValue ? { routerType: routerTypeValue } : {}),
              };
            })
            .filter((entry): entry is { path: string; filePath?: string; routerType?: string } =>
              Boolean(entry),
            )
        : [];

      const frontendAnalysis = {
        frameworks,
        components: Array.isArray((pkg as Record<string, unknown>).components)
          ? (pkg as { components: unknown[] }).components
          : [],
        routers: routeEntries.length
          ? [
              {
                type: frameworks[0] ?? "frontend",
                routerType: routeEntries[0]?.routerType ?? frameworks[0] ?? "frontend",
                routes: routeEntries,
              },
            ]
          : [],
      };

      const metadata: Record<string, unknown> = {
        ...(packageRoot ? { packageRoot, root: packageRoot } : {}),
        ...(packageJsonPath ? { sourceFile: packageJsonPath } : {}),
        frameworks,
        frontendAnalysis,
        classification: {
          detectedType: "frontend",
          source: "frontend-packages",
          reason: "aggregated",
        },
        detected: true,
      };

      entries.push([
        key,
        {
          id: key,
          artifactId: key,
          name: packageNameRaw,
          type: "frontend",
          description: "",
          metadata,
        },
      ]);
      seenComponentKeys.add(normalizedKey);
    });

    const manualViewMap = new Map<string, NormalizedClientView[]>();
    const registerManualView = (candidate: string | undefined, view: NormalizedClientView) => {
      if (typeof candidate !== "string") return;
      const normalizedKey = candidate.trim().toLowerCase();
      if (!normalizedKey) return;
      const existing = manualViewMap.get(normalizedKey);
      const keySignature = `${view.path}|${view.component ?? ""}`.toLowerCase();
      if (existing) {
        if (
          !existing.some(
            (item) => `${item.path}|${item.component ?? ""}`.toLowerCase() === keySignature,
          )
        ) {
          existing.push(view);
        }
        return;
      }
      manualViewMap.set(normalizedKey, [view]);
    };

    entries.forEach(([entryKey, value]) => {
      const type = coerceDisplayValue(value?.type);
      if (type !== "view") {
        return;
      }
      const metadata = (value?.metadata ?? {}) as Record<string, unknown>;
      const rawPath =
        coerceDisplayValue(metadata?.path) ??
        coerceDisplayValue((metadata?.route as { path?: string } | undefined)?.path) ??
        "/";
      const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath.replace(/^\/?/, "")}`;
      const componentName =
        coerceDisplayValue(metadata?.component) ??
        coerceDisplayValue(metadata?.componentName) ??
        coerceDisplayValue(value?.name) ??
        `view-${entryKey}`;
      const filePath =
        coerceDisplayValue(metadata?.filePath) ??
        coerceDisplayValue(metadata?.sourceFile) ??
        coerceDisplayValue(metadata?.source_path) ??
        undefined;
      const routerType =
        coerceDisplayValue(metadata?.routerType) ??
        coerceDisplayValue(metadata?.router_type) ??
        undefined;
      const manualView: NormalizedClientView = {
        key: `${entryKey}-manual-${slugify(normalizedPath)}-${slugify(componentName ?? "view")}`,
        path: normalizedPath,
        ...(componentName ? { component: componentName } : {}),
        ...(routerType ? { routerType } : {}),
        ...(filePath ? { filePath } : {}),
      };

      const candidateIdentifiers: Array<string | undefined> = [
        coerceDisplayValue(metadata?.clientId) ?? undefined,
        coerceDisplayValue(metadata?.clientIdentifier) ?? undefined,
        coerceDisplayValue(metadata?.clientSlug) ?? undefined,
        coerceDisplayValue(metadata?.clientName) ?? undefined,
      ];

      if (metadata?.client && typeof metadata.client === "object") {
        const clientMeta = metadata.client as Record<string, unknown>;
        candidateIdentifiers.push(
          coerceDisplayValue(clientMeta.id) ?? undefined,
          coerceDisplayValue(clientMeta.identifier) ?? undefined,
          coerceDisplayValue(clientMeta.slug) ?? undefined,
          coerceDisplayValue(clientMeta.name) ?? undefined,
        );
      }

      const viewName = coerceDisplayValue(value?.name);
      if (viewName) {
        candidateIdentifiers.push(viewName, slugify(viewName));
      }

      candidateIdentifiers.forEach((identifier) => {
        if (!identifier) return;
        registerManualView(identifier, manualView);
        registerManualView(slugify(identifier), manualView);
      });
    });

    const clients = entries
      .filter(([, value]) => {
        const type = coerceDisplayValue(value?.type);
        return type === "frontend";
      })
      .map(([key, value]) => normalizeClient(key, value, manualViewMap))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const internal = clients.filter((client) => client.hasSource || isManualClient(client));
    const external = clients
      .filter((client) => !(client.hasSource || isManualClient(client)))
      .map((client) => createExternalArtifactCard(client.identifier, client.raw));

    return { internalClients: internal, externalClients: external };
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
              <EntityCatalog
                title="Client Experiences"
                description="Explore detected frontends and add new experiences to your project catalog."
                icon={Layout}
                items={internalClients}
                isLoading={isLoading}
                emptyMessage="No code-backed clients found yet. Add one manually or ingest more sources."
                addAction={{
                  label: "Add Client",
                  onAdd: handleOpenAddClient,
                  disabled: !projectId || isCreatingClient,
                  loading: isCreatingClient,
                }}
                renderCard={(client) => (
                  <ClientCard
                    key={client.key}
                    client={client}
                    onAddView={handleOpenAddView}
                    disableAddView={isCreatingView || addViewState.open}
                  />
                )}
              />

              {externalClients.length > 0 && (
                <div className="overflow-hidden font-medium">
                  <div className="bg-gray-100 px-5 py-4 dark:bg-graphite-900/70">
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
                  <div className="px-5 py-4">
                    <div className="grid gap-3 grid-cols-1">
                      {externalClients.map((card, idx) => (
                        <React.Fragment key={card.key}>
                          <ArtifactCard name={card.name} data={card.data} onClick={noop} />
                          {idx < externalClients.length - 1 ? (
                            <hr className="border-graphite-200/40 dark:border-graphite-700/40" />
                          ) : null}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
