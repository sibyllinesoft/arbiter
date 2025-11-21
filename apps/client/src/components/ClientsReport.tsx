import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ChevronUp, Layout, Plus, Trash2 } from "lucide-react";
// @ts-nocheck
import React from "react";
import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { useTabBadgeUpdater } from "@/contexts/TabBadgeContext";
import { useResolvedSpec, useUiOptionCatalog } from "@/hooks/api-hooks";
import { apiService } from "@/services/api";
import ArtifactCard from "./ArtifactCard";
import { ARTIFACT_PANEL_BODY_CLASS, ARTIFACT_PANEL_CLASS } from "./ArtifactPanel";
import AddEntityModal from "./modals/AddEntityModal";
import {
  DEFAULT_UI_OPTION_CATALOG,
  type FieldValue,
  type UiOptionCatalog,
} from "./modals/entityTypes";
import { EntityCatalog } from "./templates/EntityCatalog";

interface ClientsReportProps {
  projectId: string;
  className?: string;
}

interface ClientMetadataItem {
  label: string;
  value: string;
}

interface NormalizedClientView {
  key: string;
  path: string;
  component?: string;
  routerType?: string;
  filePath?: string;
}

interface NormalizedClient {
  key: string;
  identifier: string;
  displayName: string;
  description?: string;
  metadataItems: ClientMetadataItem[];
  views: NormalizedClientView[];
  hasSource: boolean;
  sourcePath?: string;
  typeLabel?: string;
  language?: string | null;
  raw: any;
}

interface ExternalArtifactCard {
  key: string;
  name: string;
  description?: string;
  data: Record<string, unknown>;
}

const PATH_PRIORITY_CANDIDATES = [
  "source",
  "sourcePath",
  "path",
  "filePath",
  "entry",
  "entryFile",
  "entryPoint",
  "src",
  "root",
  "rootDir",
  "rootDirectory",
  "basePath",
  "repositoryPath",
  "projectPath",
  "packagePath",
  "modulePath",
  "relativePath",
];

const coerceDisplayValue = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase() === "unknown" ? null : trimmed;
};

const isLikelyCodePath = (value: string): boolean => {
  const lower = value.toLowerCase();
  if (!lower) return false;
  if (/(\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte))$/.test(lower)) return true;
  if (
    lower.endsWith(".py") ||
    lower.endsWith(".go") ||
    lower.endsWith(".rs") ||
    lower.endsWith(".java")
  )
    return true;
  if (
    lower.includes("src/") ||
    lower.includes("apps/") ||
    lower.includes("packages/") ||
    lower.includes("frontend")
  )
    return true;
  return false;
};

const isInfrastructurePath = (value: string): boolean => {
  const lower = value.toLowerCase();
  return (
    lower.includes("dockerfile") ||
    lower.includes("docker-compose") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml") ||
    lower.includes("compose.yml") ||
    lower.includes("compose.yaml")
  );
};

const collectPathCandidates = (raw: any): string[] => {
  const paths = new Set<string>();

  PATH_PRIORITY_CANDIDATES.forEach((key) => {
    const directValue = raw?.[key];
    if (typeof directValue === "string" && directValue.trim()) {
      paths.add(directValue.trim());
    }
  });

  const metadata = raw?.metadata;
  if (metadata && typeof metadata === "object") {
    PATH_PRIORITY_CANDIDATES.forEach((key) => {
      const metaValue = metadata[key];
      if (typeof metaValue === "string" && metaValue.trim()) {
        paths.add(metaValue.trim());
      }
    });

    Object.entries(metadata as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === "string" && value.trim()) {
        const normalizedKey = key.toLowerCase();
        if (
          normalizedKey.includes("path") ||
          normalizedKey.includes("root") ||
          normalizedKey.includes("file") ||
          normalizedKey.includes(" directory")
        ) {
          paths.add(value.trim());
        }
      }
    });
  }

  return Array.from(paths);
};

const resolveSourcePath = (raw: any): { path: string | undefined; hasSource: boolean } => {
  const candidates = collectPathCandidates(raw);
  if (candidates.length === 0) {
    return { path: undefined, hasSource: false };
  }

  const codeCandidate = candidates.find((candidate) => isLikelyCodePath(candidate));
  if (codeCandidate) {
    return { path: codeCandidate, hasSource: true };
  }

  const nonInfrastructureCandidate = candidates.find(
    (candidate) => !isInfrastructurePath(candidate),
  );
  if (nonInfrastructureCandidate) {
    return { path: nonInfrastructureCandidate, hasSource: true };
  }

  return { path: candidates[0], hasSource: false };
};

const extractTypeLabel = (raw: any): string | undefined => {
  const normalize = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  // Prefer detailed framework information from frontend analysis if present
  const analysisFrameworks = raw?.metadata?.frontendAnalysis?.frameworks;
  if (Array.isArray(analysisFrameworks)) {
    const framework = analysisFrameworks.map(normalize).find(Boolean);
    if (framework) return framework;
  }

  const classification = raw?.metadata?.classification;
  if (classification && typeof classification === "object") {
    const classificationFields = [
      "detail",
      "label",
      "platform",
      "detectedType",
      "type",
      "category",
    ];
    for (const field of classificationFields) {
      const value = normalize((classification as Record<string, unknown>)[field]);
      if (value && value.toLowerCase() !== "frontend") {
        return value;
      }
    }
  }

  const clientMeta = raw?.metadata?.client;
  if (clientMeta && typeof clientMeta === "object") {
    const clientFields = ["platform", "type", "variant", "category"];
    for (const field of clientFields) {
      const value = normalize((clientMeta as Record<string, unknown>)[field]);
      if (value) return value;
    }
  }

  const explicitCandidates = [
    raw?.metadata?.clientType,
    raw?.metadata?.client_type,
    raw?.metadata?.frontendType,
    raw?.metadata?.frontend_type,
    raw?.metadata?.platform,
  ];
  for (const candidate of explicitCandidates) {
    const value = normalize(candidate);
    if (value && value.toLowerCase() !== "frontend") {
      return value;
    }
  }

  const metadataType = normalize(raw?.metadata?.type);
  if (metadataType) {
    return metadataType.replace(/_/g, " ");
  }

  const type = normalize(raw?.type);
  if (type) {
    return type.replace(/_/g, " ");
  }

  return undefined;
};

const extractClientViews = (raw: any): NormalizedClientView[] => {
  const analysis = raw?.metadata?.frontendAnalysis;
  if (!analysis) return [];

  const routeMap = new Map<string, NormalizedClientView>();
  const routers = Array.isArray(analysis.routers) ? analysis.routers : [];

  routers.forEach((router: any) => {
    const routerType = coerceDisplayValue(router?.type) ?? coerceDisplayValue(router?.name);
    const routes = Array.isArray(router?.routes) ? router.routes : [];
    routes.forEach((route: any, index: number) => {
      const rawPath = typeof route?.path === "string" ? route.path.trim() : "";
      if (!rawPath) return;
      const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
      if (normalizedPath === "/api" || normalizedPath.startsWith("/api/")) {
        return;
      }
      const key = `${normalizedPath}@${routerType ?? "router"}@${index}`;
      if (routeMap.has(key)) return;
      const componentId = coerceDisplayValue(route?.component);
      const moduleId = coerceDisplayValue(route?.metadata?.module || route?.metadata?.component);
      const metadataBasePath = coerceDisplayValue(
        route?.metadata?.basePath ||
          route?.metadata?.base_path ||
          route?.metadata?.mountPath ||
          route?.metadata?.mount_path ||
          route?.metadata?.pathPrefix ||
          route?.metadata?.path_prefix,
      );
      const routerBasePath = coerceDisplayValue(
        router?.basePath || router?.pathPrefix || router?.prefix,
      );
      const candidateBasePath = metadataBasePath || routerBasePath;
      let pathLabelSource = normalizedPath.startsWith("/api/")
        ? normalizedPath.slice(5)
        : normalizedPath.replace(/^\//, "");
      if (candidateBasePath) {
        const normalizedBase = candidateBasePath.startsWith("/")
          ? candidateBasePath
          : `/${candidateBasePath.replace(/^\//, "")}`;
        if (normalizedPath === normalizedBase) {
          pathLabelSource = "";
        } else if (normalizedPath.startsWith(`${normalizedBase}/`)) {
          pathLabelSource = normalizedPath.slice(normalizedBase.length + 1);
        }
      }
      const pathSegments = pathLabelSource.split("/").filter(Boolean);
      const pathLabel = pathSegments[pathSegments.length - 1] || pathLabelSource || normalizedPath;
      const label = componentId || moduleId || pathLabel || `view-${index + 1}`;
      const filePath = coerceDisplayValue(route?.filePath);
      const view: NormalizedClientView = {
        key,
        path: normalizedPath,
        component: label,
        ...(routerType ? { routerType } : {}),
        ...(filePath ? { filePath } : {}),
      };
      routeMap.set(key, view);
    });
  });

  return Array.from(routeMap.values()).sort((a, b) => a.path.localeCompare(b.path));
};

const noop = () => {};

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isManualClient = (client: NormalizedClient): boolean => {
  const classification = client.raw?.metadata?.classification;
  if (!classification || typeof classification !== "object") {
    return false;
  }
  const source = (classification as Record<string, unknown>).source;
  const reason = (classification as Record<string, unknown>).reason;
  return source === "user" || reason === "manual-entry";
};
const createExternalArtifactCard = (identifier: string, raw: any): ExternalArtifactCard => {
  const description =
    coerceDisplayValue(raw?.description) ??
    coerceDisplayValue(raw?.metadata?.description) ??
    coerceDisplayValue(raw?.metadata?.summary) ??
    undefined;
  const name = coerceDisplayValue(raw?.name) ?? identifier;
  const card: ExternalArtifactCard = {
    key: `external-${identifier}`,
    name,
    data: {
      name,
      metadata: raw?.metadata ?? {},
    },
  };
  if (description) {
    card.description = description;
    card.data.description = description;
  }
  return card;
};

const normalizeClient = (
  key: string,
  raw: any,
  manualViewMap: Map<string, NormalizedClientView[]>,
): NormalizedClient => {
  const identifier = coerceDisplayValue(raw?.artifactId) ?? coerceDisplayValue(raw?.id) ?? key;
  let displayName = coerceDisplayValue(raw?.name) ?? identifier;
  const description =
    coerceDisplayValue(raw?.description) ??
    coerceDisplayValue(raw?.metadata?.description) ??
    undefined;

  const { path: sourcePath, hasSource } = resolveSourcePath(raw);
  const language = coerceDisplayValue(raw?.metadata?.language ?? raw?.language);
  const framework = coerceDisplayValue(raw?.metadata?.framework ?? raw?.framework);
  const typeLabelRaw = extractTypeLabel(raw);
  const typeLabel = typeLabelRaw
    ? typeLabelRaw.charAt(0).toUpperCase() + typeLabelRaw.slice(1)
    : undefined;
  const baseViews = extractClientViews(raw);

  const metaFilePath =
    typeof raw?.metadata?.filePath === "string" ? raw.metadata.filePath : undefined;
  if (!displayName && metaFilePath) {
    const candidate = metaFilePath.split("/").pop()?.split(".")[0];
    if (candidate) displayName = candidate;
  }

  const metadataItems: ClientMetadataItem[] = [];
  if (language) {
    metadataItems.push({ label: "Language", value: language });
  }
  if (framework) {
    metadataItems.push({ label: "Framework", value: framework });
  }
  if (typeLabel) {
    metadataItems.push({
      label: "Type",
      value: typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1),
    });
  }
  if (sourcePath) {
    metadataItems.push({ label: "Source", value: sourcePath });
  }

  const combinedViews: NormalizedClientView[] = [];
  const seenViewKeys = new Set<string>();

  const registerView = (view: NormalizedClientView) => {
    const key = `${view.path}|${view.component ?? ""}`.toLowerCase();
    if (seenViewKeys.has(key)) return;
    seenViewKeys.add(key);
    combinedViews.push(view);
  };

  baseViews.forEach(registerView);

  const candidateKeys = [
    identifier,
    slugify(identifier ?? ""),
    displayName,
    slugify(displayName ?? ""),
  ];

  candidateKeys.forEach((candidate) => {
    if (!candidate) return;
    const normalizedKey = candidate.trim().toLowerCase();
    if (!normalizedKey) return;
    const manualViews = manualViewMap.get(normalizedKey);
    if (!manualViews) return;
    manualViews.forEach(registerView);
  });

  metadataItems.push({ label: "Views", value: String(combinedViews.length) });

  const normalized: NormalizedClient = {
    key: identifier ?? key,
    identifier: identifier ?? key,
    displayName: displayName ?? identifier ?? key,
    metadataItems,
    views: combinedViews,
    hasSource,
    raw,
  };

  if (description) {
    normalized.description = description;
  }
  if (sourcePath) {
    normalized.sourcePath = sourcePath;
  }
  if (typeLabel) {
    normalized.typeLabel = typeLabel;
  }
  if (language) {
    normalized.language = language;
  }

  return normalized;
};

const ClientCard: FC<{
  client: NormalizedClient;
  onDelete?: (client: NormalizedClient) => void;
  onAddView?: (client: NormalizedClient) => void;
  disableAddView?: boolean;
}> = ({ client, onDelete, onAddView, disableAddView = false }) => {
  const [expanded, setExpanded] = useState(true);

  const handleToggle = () => setExpanded((previous) => !previous);
  const handleDelete = () => {
    if (onDelete) {
      onDelete(client);
    }
  };
  const handleAddView = () => {
    onAddView?.(client);
  };

  const deleteDisabled = typeof onDelete !== "function";
  const addViewDisabled = disableAddView || typeof onAddView !== "function";

  return (
    <div className={clsx(ARTIFACT_PANEL_CLASS, "overflow-hidden font-medium")}>
      <div className="border-b border-graphite-200/60 bg-gray-100 px-3 py-2 dark:border-graphite-700/60 dark:bg-graphite-900/70">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={expanded}
            className="flex flex-1 items-center gap-3 px-1 py-1.5 text-left font-semibold transition-colors hover:text-graphite-900 dark:hover:text-graphite-25"
          >
            <Layout className="h-4 w-4 text-gray-900 dark:text-white" />
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              {client.displayName || client.identifier}
            </span>
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleAddView}
              className={clsx(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
                addViewDisabled
                  ? "cursor-not-allowed text-gray-400 dark:text-graphite-500"
                  : "text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-400/10",
              )}
              disabled={addViewDisabled}
              aria-label="Add view"
            >
              <Plus
                className={clsx(
                  "h-4 w-4",
                  addViewDisabled
                    ? "text-gray-400 dark:text-graphite-500"
                    : "text-blue-600 dark:text-blue-300",
                )}
              />
              <span className="hidden sm:inline">Add view</span>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Delete client"
              className={clsx(
                "p-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-rose-500",
                deleteDisabled
                  ? "cursor-not-allowed text-gray-400 dark:text-graphite-500"
                  : "text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-400/10",
              )}
              disabled={deleteDisabled}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleToggle}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse client details" : "Expand client details"}
              className="p-2 rounded-md text-gray-500 hover:text-graphite-900 hover:bg-gray-100 dark:text-graphite-300 dark:hover:text-graphite-25 dark:hover:bg-graphite-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
            >
              <ChevronUp
                className={clsx(
                  "h-4 w-4 transition-transform",
                  expanded ? "rotate-180" : "rotate-0",
                )}
              />
            </button>
          </div>
        </div>
        <div
          className={clsx(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            expanded ? "max-h-[320px] opacity-100" : "max-h-0 opacity-0 pointer-events-none",
          )}
          aria-hidden={!expanded}
        >
          <div className="mt-3 space-y-4 text-sm">
            {client.description && (
              <p className="text-gray-600/80 dark:text-graphite-200/80">{client.description}</p>
            )}
            <div className="flex flex-wrap justify-around gap-4 text-sm bg-white dark:bg-graphite-950">
              {client.metadataItems.map((item) => (
                <div
                  key={`${client.identifier}-${item.label}`}
                  className="flex items-baseline gap-1 text-gray-700/80 dark:text-graphite-200/80"
                >
                  <span className="uppercase tracking-wide text-[11px] font-medium text-gray-500/80 dark:text-graphite-300/80">
                    {item.label}:
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className={clsx(
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
          expanded ? "max-h-[680px] opacity-100" : "max-h-0 opacity-0 pointer-events-none",
        )}
        aria-hidden={!expanded}
      >
        <div className="px-5 py-4 font-medium bg-white dark:bg-graphite-950">
          {client.views.length > 0 ? (
            <div className="space-y-3">
              {client.views.map((view, idx) => (
                <React.Fragment key={view.key}>
                  <div className="space-y-1 rounded-md px-1 py-1 text-sm">
                    <span className="block font-semibold text-blue-600 dark:text-blue-400">
                      {view.path}
                    </span>
                    {view.component && (
                      <div className="text-xs text-gray-600/80 dark:text-graphite-200/80">
                        Component:{" "}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {view.component}
                        </span>
                      </div>
                    )}
                    {view.filePath && (
                      <div className="text-xs text-gray-500/80 dark:text-graphite-300/80">
                        {view.filePath}
                      </div>
                    )}
                  </div>
                  {idx < client.views.length - 1 ? (
                    <hr className="border-graphite-200/40 dark:border-graphite-700/40" />
                  ) : null}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-graphite-300 text-center">
              No views present.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

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
// @ts-nocheck
