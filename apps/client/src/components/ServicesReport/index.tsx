import { clsx } from "clsx";
import { Network } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { useTabBadgeUpdater } from "@/contexts/TabBadgeContext";
import { Button } from "@/design-system";
import {
  createExternalArtifactCard,
  normalizeContainersAsExternalCards,
  normalizeService,
} from "@/features/spec/transformers/services";
import { buildEndpointDraftIdentifier } from "@/features/spec/utils/services";
import { useProject } from "@/hooks/api-hooks";
import { useCatalog } from "@/hooks/useCatalog";
import { useProjectEntityPersistence } from "@/hooks/useProjectEntityPersistence";
import { apiService } from "@/services/api";
import type { ResolvedSpecResponse } from "@/types/api";
import { ArtifactCard } from "../ArtifactCard";
import AddEntityModal from "../modals/AddEntityModal";
import EndpointModal from "../modals/EndpointModal";
import {
  DEFAULT_UI_OPTION_CATALOG,
  type FieldValue,
  type UiOptionCatalog,
} from "../modals/entityTypes";
import { shouldTreatAsInternalService } from "../services/internal-service-classifier";
import {
  buildEndpointInitialValues,
  buildExternalServiceInitialValues,
  buildServiceInitialValues,
} from "./builders";
import { ServiceCard } from "./components/ServiceCard";
import type {
  ExternalArtifactCard,
  NormalizedEndpointCard,
  NormalizedService,
  ServicesReportProps,
} from "./types";

export const ServicesReport: React.FC<ServicesReportProps> = ({ projectId, className }) => {
  const catalog = useCatalog<ResolvedSpecResponse>(projectId);
  const { data, isLoading, isError, error } = catalog;
  const { data: projectData } = useProject(projectId);
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [isCreatingService, setIsCreatingService] = useState(false);
  const uiOptionCatalog = useMemo<UiOptionCatalog>(
    () => catalog.uiOptionCatalog,
    [catalog.uiOptionCatalog],
  );
  const [addEndpointState, setAddEndpointState] = useState<{
    open: boolean;
    service: NormalizedService | null;
  }>({ open: false, service: null });
  const [editEndpointState, setEditEndpointState] = useState<{
    open: boolean;
    service: NormalizedService | null;
    endpoint: NormalizedEndpointCard | null;
  }>({ open: false, service: null, endpoint: null });
  const [serviceDetailState, setServiceDetailState] = useState<{
    open: boolean;
    service: NormalizedService | null;
    initialValues?: Record<string, FieldValue>;
    artifactId?: string | null;
    mode: "create" | "edit";
  }>({ open: false, service: null, mode: "edit", artifactId: null });

  const refreshResolved = useCallback(
    async (options: { silent?: boolean } = {}) => {
      await catalog.refresh(options);
    },
    [catalog],
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

  const handleOpenAddEndpointModal = useCallback((service: NormalizedService) => {
    setAddEndpointState({ open: true, service });
  }, []);

  const handleCloseAddEndpointModal = useCallback(() => {
    setAddEndpointState({ open: false, service: null });
  }, []);

  const handleOpenEditEndpointModal = useCallback(
    (service: NormalizedService, endpoint: NormalizedEndpointCard) => {
      setEditEndpointState({ open: true, service, endpoint });
    },
    [],
  );

  const handleCloseEditEndpointModal = useCallback(() => {
    setEditEndpointState({ open: false, service: null, endpoint: null });
  }, []);

  const handleOpenServiceModal = useCallback((service: NormalizedService) => {
    const initialValues = buildServiceInitialValues(service);
    setServiceDetailState({
      open: true,
      service,
      initialValues,
      artifactId: service.artifactId ?? null,
      mode: "edit",
    });
  }, []);

  const handleCloseServiceModal = useCallback(() => {
    setServiceDetailState({ open: false, service: null, artifactId: null, mode: "edit" });
  }, []);

  const handleSubmitAddEndpoint = useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      if (!addEndpointState.service) {
        return;
      }
      const methodValue =
        typeof payload.values.method === "string" ? payload.values.method.toUpperCase() : "GET";
      const rawPath = typeof payload.values.path === "string" ? payload.values.path.trim() : "";
      const pathValue = rawPath || "/";
      const enhancedValues: Record<string, FieldValue> = {
        ...payload.values,
        method: methodValue,
        path: pathValue,
        serviceId: addEndpointState.service.identifier,
      };
      const draftIdentifier = buildEndpointDraftIdentifier(
        addEndpointState.service.identifier,
        methodValue,
        pathValue,
      );
      const success = await persistEntity({
        entityType: payload.entityType,
        values: enhancedValues,
        draftIdentifier,
      });
      if (success) {
        handleCloseAddEndpointModal();
        toast.success("Endpoint added successfully");
      }
    },
    [addEndpointState.service, persistEntity, handleCloseAddEndpointModal],
  );

  const handleOpenExternalServiceModal = useCallback((card: ExternalArtifactCard) => {
    const initialValues = buildExternalServiceInitialValues(card);
    setServiceDetailState({
      open: true,
      service: null,
      initialValues,
      artifactId: null,
      mode: "create",
    });
  }, []);

  const handleSubmitEditEndpoint = useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      if (!editEndpointState.service || !editEndpointState.endpoint) {
        return;
      }
      const endpointMetadata = (editEndpointState.endpoint.data?.metadata ?? {}) as Record<
        string,
        unknown
      >;
      const artifactIdFromMetadata = (() => {
        if (typeof endpointMetadata.artifactId === "string")
          return endpointMetadata.artifactId as string;
        if (typeof endpointMetadata.artifact_id === "string")
          return endpointMetadata.artifact_id as string;
        if (typeof endpointMetadata.entityId === "string")
          return endpointMetadata.entityId as string;
        if (typeof endpointMetadata.entity_id === "string")
          return endpointMetadata.entity_id as string;
        const dataArtifact = editEndpointState.endpoint.data?.artifactId;
        if (typeof dataArtifact === "string") return dataArtifact;
        return undefined;
      })();
      const artifactIdFromValues =
        typeof payload.values.artifactId === "string"
          ? (payload.values.artifactId as string)
          : undefined;
      const methodValue =
        typeof payload.values.method === "string" ? payload.values.method.toUpperCase() : "GET";
      const rawPath = typeof payload.values.path === "string" ? payload.values.path.trim() : "";
      const pathValue = rawPath || "/";
      const enhancedValues: Record<string, FieldValue> = {
        ...payload.values,
        method: methodValue,
        path: pathValue,
        serviceId: editEndpointState.service.identifier,
      };
      const draftIdentifier = buildEndpointDraftIdentifier(
        editEndpointState.service.identifier,
        methodValue,
        pathValue,
      );
      const success = await persistEntity({
        entityType: payload.entityType,
        values: enhancedValues,
        artifactId: artifactIdFromMetadata ?? artifactIdFromValues ?? null,
        draftIdentifier,
      });
      if (success) {
        handleCloseEditEndpointModal();
        toast.success("Endpoint updated successfully");
      }
    },
    [
      editEndpointState.service,
      editEndpointState.endpoint,
      persistEntity,
      handleCloseEditEndpointModal,
    ],
  );

  const handleSubmitServiceModal = useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      if (!serviceDetailState.service && serviceDetailState.mode === "edit") {
        return;
      }
      const draftIdentifier =
        serviceDetailState.service?.identifier ||
        (typeof payload.values?.name === "string" ? payload.values.name : undefined);
      const success = await persistEntity({
        entityType: payload.entityType,
        values: payload.values,
        artifactId: serviceDetailState.artifactId ?? null,
        draftIdentifier: draftIdentifier ?? null,
      });
      if (success) {
        toast.success(
          serviceDetailState.mode === "edit"
            ? "Service updated successfully"
            : "Service added successfully",
        );
        handleCloseServiceModal();
      }
    },
    [serviceDetailState, persistEntity, handleCloseServiceModal],
  );

  const { internalServices, externalCards } = useMemo(() => {
    const resolved = data?.resolved as Record<string, any> | undefined;
    const spec = resolved?.spec ?? resolved;
    const servicesSource = spec?.services ?? {};
    const containers = spec?.infrastructure?.containers;

    const serviceEntries: Array<[string, any]> = [];
    if (Array.isArray(servicesSource)) {
      servicesSource.forEach((service, index) => {
        serviceEntries.push([`service-${index + 1}`, service]);
      });
    } else if (servicesSource && typeof servicesSource === "object") {
      Object.entries(servicesSource).forEach(([key, service]) => {
        serviceEntries.push([key, service]);
      });
    }

    const normalizedServices = serviceEntries
      .map(([key, service]) => normalizeService(key, service))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const internal: NormalizedService[] = [];
    const external: ExternalArtifactCard[] = [];

    // DEBUG: Log all services data in one object
    console.log("=== ALL SERVICES DEBUG DUMP ===", {
      totalServices: normalizedServices.length,
      services: normalizedServices.map((service) => ({
        identifier: service.identifier,
        displayName: service.displayName,
        isInternal: shouldTreatAsInternalService(service),
        type: service.raw?.type,
        hasMetadata: Boolean(service.raw?.metadata),
        manifest: (service.raw?.metadata as any)?.manifest,
        metadataType: (service.raw?.metadata as any)?.type,
        metadataKeys: service.raw?.metadata ? Object.keys(service.raw.metadata) : [],
        rawKeys: service.raw ? Object.keys(service.raw) : [],
        fullRaw: service.raw,
      })),
    });

    normalizedServices.forEach((service) => {
      if (shouldTreatAsInternalService(service)) {
        internal.push(service);
      } else {
        external.push(createExternalArtifactCard(service.identifier, service.raw));
      }
    });

    // Create a set of internal service root paths for deduplication
    const internalServiceRoots = new Set<string>();
    console.log(
      `[DEDUP] Found ${internal.length} internal services, ${external.length} external services`,
    );

    internal.forEach((service) => {
      // Use the root path from metadata as the dedup key
      const metadata =
        service.raw && typeof service.raw === "object"
          ? (service.raw as Record<string, unknown>).metadata
          : undefined;
      const root =
        metadata && typeof metadata === "object"
          ? (metadata as Record<string, unknown>).root
          : undefined;

      if (typeof root === "string") {
        internalServiceRoots.add(root.toLowerCase());
        console.log(`[DEDUP] Internal service "${service.displayName}" - root: ${root}`);
      }
    });

    console.log(`[DEDUP] Internal service roots:`, Array.from(internalServiceRoots));

    // Filter out external services that have the same root as an internal service
    const filteredExternal = external.filter((card) => {
      const metadata = card.data?.metadata;
      const root =
        metadata && typeof metadata === "object"
          ? (metadata as Record<string, unknown>).root
          : undefined;

      const rootPath = typeof root === "string" ? root.toLowerCase() : null;
      const matchesInternal = rootPath ? internalServiceRoots.has(rootPath) : false;

      console.log(
        `[DEDUP] External service "${card.name}" - root: ${rootPath}, matches: ${matchesInternal}`,
      );

      if (matchesInternal) {
        console.log(
          `[DEDUP] ✅ Filtering out external service "${card.name}" - same root as internal service`,
        );
      }

      return !matchesInternal;
    });

    const knownIdentifiers = new Set<string>([
      ...normalizedServices.map((service) => service.identifier),
      ...filteredExternal.map((card) => card.key),
    ]);

    const containerCards = normalizeContainersAsExternalCards(containers, knownIdentifiers);
    containerCards.forEach((card) => filteredExternal.push(card));

    const dedupedExternal = Array.from(
      filteredExternal.reduce((acc, card) => {
        const dedupeKey = card.key || card.name;
        if (!acc.has(dedupeKey)) {
          acc.set(dedupeKey, card);
        }
        return acc;
      }, new Map<string, ExternalArtifactCard>()),
    ).map(([, card]) => card);

    return {
      internalServices: internal,
      externalCards: dedupedExternal,
    };
  }, [data?.resolved]);

  const tabBadgeUpdater = useTabBadgeUpdater();
  const resolvedProject = (data?.resolved as { project?: { entities?: Record<string, unknown> } })
    ?.project;
  const resolvedEntities = resolvedProject?.entities as Record<string, unknown> | undefined;
  const projectServiceCount =
    typeof projectData?.entities?.services === "number"
      ? (projectData.entities.services as number)
      : null;
  const resolvedServiceCount =
    typeof resolvedEntities?.["services"] === "number"
      ? (resolvedEntities["services"] as number)
      : null;
  const serviceCount =
    isLoading || isError
      ? null
      : (projectServiceCount ?? resolvedServiceCount ?? internalServices.length);

  useEffect(() => {
    if (!projectId) {
      tabBadgeUpdater("services", null);
      return () => {
        tabBadgeUpdater("services", null);
      };
    }
    if (serviceCount == null) {
      tabBadgeUpdater("services", null);
      return () => {
        tabBadgeUpdater("services", null);
      };
    }
    tabBadgeUpdater("services", serviceCount);
    return () => {
      tabBadgeUpdater("services", null);
    };
  }, [projectId, serviceCount, tabBadgeUpdater]);

  const handleOpenAddService = useCallback(() => {
    setIsAddServiceOpen(true);
  }, []);

  const handleCloseAddService = useCallback(() => {
    if (isCreatingService) return;
    setIsAddServiceOpen(false);
  }, [isCreatingService]);

  const handleSubmitAddService = useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      if (!projectId || isCreatingService) {
        return;
      }

      try {
        setIsCreatingService(true);
        const normalizedValues = Object.fromEntries(
          Object.entries(payload.values).map(([key, value]) => [key, value as unknown]),
        );
        await apiService.createProjectEntity(projectId, {
          type: payload.entityType,
          values: normalizedValues,
        });
        await refreshResolved();
        toast.success("Service added successfully");
        setIsAddServiceOpen(false);
      } catch (submissionError) {
        console.error("[ServicesReport] Failed to add service", submissionError);
        const message =
          submissionError instanceof Error ? submissionError.message : "Failed to add service";
        toast.error(message);
      } finally {
        setIsCreatingService(false);
      }
    },
    [projectId, isCreatingService, refreshResolved],
  );

  return (
    <div className={clsx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-gray-600 dark:text-graphite-300">
            Loading services...
          </div>
        ) : isError ? (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-rose-600 dark:text-rose-400">
            {error instanceof Error ? error.message : "Unable to load services for this project."}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
            <div className="border-b border-graphite-200/60 bg-gray-100 px-6 py-6 dark:border-graphite-700/60 dark:bg-graphite-900/70">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center text-blue-600 dark:text-blue-200">
                    <Network className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25">
                      Catalog
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-graphite-300">
                      Manage detected application services and external runtimes powering this
                      project.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleOpenAddService}
                  disabled={!projectId || isCreatingService}
                  loading={isCreatingService}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors",
                    "hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:bg-blue-400 disabled:text-blue-100",
                  )}
                >
                  Add Service
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-transparent">
              <div className="space-y-6">
                {internalServices.length > 0 ? (
                  <div className={"overflow-hidden font-medium"}>
                    <div className="grid gap-3 grid-cols-1">
                      {internalServices.map((service) => (
                        <ServiceCard
                          key={service.key}
                          service={service}
                          onAddEndpoint={handleOpenAddEndpointModal}
                          onEditEndpoint={handleOpenEditEndpointModal}
                          onEditService={handleOpenServiceModal}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-graphite-300">
                    No code-backed services detected yet. Use the Add Service button to document new
                    services or ingest additional repositories.
                  </p>
                )}

                {externalCards.length > 0 ? (
                  <div className="overflow-hidden font-medium rounded-lg border border-graphite-200/60 dark:border-graphite-700/60">
                    <div className="border-b border-graphite-200/60 bg-gray-100 px-4 py-3 dark:border-graphite-700/60 dark:bg-graphite-900/70">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-900/70 dark:text-graphite-50/70">
                          <Network className="h-4 w-4" />
                          <span>External Services</span>
                        </div>
                        <span className="text-xs text-gray-500/70 dark:text-graphite-300/70">
                          {externalCards.length}
                        </span>
                      </div>
                    </div>
                    <div className="px-3 py-3 md:px-4 md:py-4">
                      <div className="grid gap-3 grid-cols-1">
                        {externalCards.map((card) => (
                          <ArtifactCard
                            key={card.key}
                            name={card.name}
                            data={card.data}
                            onClick={() => handleOpenExternalServiceModal(card)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      <AddEntityModal
        open={isAddServiceOpen}
        entityType="service"
        groupLabel="Services"
        optionCatalog={uiOptionCatalog}
        onClose={handleCloseAddService}
        mode="create"
        onSubmit={async (payload) => {
          await handleSubmitAddService(payload);
        }}
      />
      {serviceDetailState.open && (
        <AddEntityModal
          open={serviceDetailState.open}
          entityType="service"
          groupLabel="Services"
          optionCatalog={uiOptionCatalog}
          onClose={handleCloseServiceModal}
          mode={serviceDetailState.mode}
          initialValues={serviceDetailState.initialValues}
          titleOverride={
            serviceDetailState.mode === "edit" && serviceDetailState.service
              ? `Update ${serviceDetailState.service.displayName || serviceDetailState.service.identifier}`
              : serviceDetailState.initialValues?.name
                ? `Document ${serviceDetailState.initialValues.name}`
                : "Document Service"
          }
          descriptionOverride={
            serviceDetailState.mode === "edit"
              ? "Review the service details, update metadata, and save your changes."
              : "Capture metadata for this service to promote it into the catalog."
          }
          onSubmit={async (payload) => {
            await handleSubmitServiceModal(payload);
          }}
        />
      )}
      {addEndpointState.open && addEndpointState.service && (
        <EndpointModal
          open={addEndpointState.open}
          onClose={handleCloseAddEndpointModal}
          onSubmit={handleSubmitAddEndpoint}
          groupLabel={`Endpoints for ${addEndpointState.service.displayName || addEndpointState.service.identifier}`}
          mode="create"
        />
      )}
      {editEndpointState.open && editEndpointState.service && editEndpointState.endpoint && (
        <EndpointModal
          open={editEndpointState.open}
          onClose={handleCloseEditEndpointModal}
          onSubmit={handleSubmitEditEndpoint}
          groupLabel={`Endpoints for ${editEndpointState.service.displayName || editEndpointState.service.identifier}`}
          mode="edit"
          initialValues={buildEndpointInitialValues(editEndpointState.endpoint)}
        />
      )}
    </div>
  );
};

export type { NormalizedService, ServicesReportProps };
export default ServicesReport;
