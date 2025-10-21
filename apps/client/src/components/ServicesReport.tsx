import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { Boxes, ChevronUp, Folder, Languages, Network, Plus, Server, Workflow } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { useResolvedSpec } from "@/hooks/api-hooks";
import { useProjectEntityPersistence } from "@/hooks/useProjectEntityPersistence";
import { apiService } from "@/services/api";
import { ArtifactCard } from "./ArtifactCard";
import { ARTIFACT_PANEL_BODY_CLASS, ARTIFACT_PANEL_CLASS } from "./ArtifactPanel";
import {
  AddEntityModal,
  DEFAULT_UI_OPTION_CATALOG,
  type FieldValue,
  type UiOptionCatalog,
} from "./modals/AddEntityModal";
import EndpointModal from "./modals/EndpointModal";

interface ServicesReportProps {
  projectId: string;
  className?: string;
}

interface ServiceMetadataItem {
  label: string;
  value: string;
  icon: LucideIcon;
}

interface NormalizedEndpointCard {
  key: string;
  name: string;
  data: Record<string, unknown>;
}

interface NormalizedService {
  key: string;
  identifier: string;
  displayName: string;
  description?: string;
  metadataItems: ServiceMetadataItem[];
  endpoints: NormalizedEndpointCard[];
  hasSource: boolean;
  typeLabel?: string;
  raw: Record<string, unknown> | null;
  sourcePath?: string;
}

interface ExternalArtifactCard {
  key: string;
  name: string;
  data: Record<string, unknown>;
}

const noop = () => {};

const TYPE_BADGE_STYLES: Record<string, string> = {
  service: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  api: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  worker: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200",
  job: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
  queue: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
};

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildEndpointDraftIdentifier = (serviceId: string, method: string, path: string): string =>
  slugify(`${serviceId}-${method || "any"}-${path || "endpoint"}`);

const buildEndpointInitialValues = (
  endpoint: NormalizedEndpointCard,
): Record<string, FieldValue> => {
  const data = (endpoint.data ?? {}) as Record<string, unknown>;
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;

  const httpMethods = Array.isArray(data.httpMethods)
    ? (data.httpMethods as unknown[])
    : Array.isArray(metadata?.httpMethods)
      ? (metadata.httpMethods as unknown[])
      : [];
  const methodCandidate = httpMethods.find((value) => typeof value === "string") as
    | string
    | undefined;
  const method = methodCandidate ? methodCandidate.toUpperCase() : "GET";

  const rawPathCandidate =
    (typeof data.path === "string" && data.path) ||
    (typeof metadata.routePath === "string" && metadata.routePath) ||
    (typeof metadata.path === "string" && metadata.path) ||
    "/";
  const pathCandidate = rawPathCandidate?.toString().trim() || "/";

  const summaryCandidate =
    (typeof metadata.summary === "string" && metadata.summary) ||
    (typeof data.name === "string" && data.name) ||
    "";

  const descriptionCandidate =
    (typeof data.description === "string" && data.description) ||
    (typeof metadata.description === "string" && metadata.description) ||
    "";

  const operationIdCandidate =
    (typeof metadata.operationId === "string" && metadata.operationId) || "";

  const rawTags = (metadata as Record<string, unknown>).tags;
  const tagsCandidate = Array.isArray(rawTags)
    ? rawTags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag)
    : typeof rawTags === "string"
      ? rawTags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : [];

  const artifactIdCandidate =
    (typeof metadata.artifactId === "string" && metadata.artifactId) ||
    (typeof metadata.artifact_id === "string" && metadata.artifact_id) ||
    (typeof data.artifactId === "string" && data.artifactId) ||
    undefined;

  const initialValues: Record<string, FieldValue> = {
    method,
    path: pathCandidate,
    summary: summaryCandidate,
    description: descriptionCandidate,
    operationId: operationIdCandidate,
    tags: tagsCandidate,
  };

  if (artifactIdCandidate) {
    initialValues.artifactId = artifactIdCandidate;
  }

  return initialValues;
};

const PATH_PRIORITY_CANDIDATES = [
  "packagePath",
  "package_path",
  "packageRoot",
  "package_root",
  "filePath",
  "file_path",
  "sourcePath",
  "source_path",
  "path",
  "root",
  "rootPath",
  "root_path",
  "projectPath",
  "project_path",
  "repositoryPath",
  "repository_path",
  "directory",
  "entryPoint",
  "entrypoint",
  "modulePath",
  "module_path",
  "relativePath",
  "relative_path",
];

const isLikelyCodePath = (value: string): boolean => {
  const lower = value.toLowerCase();
  if (!lower) return false;
  if (
    lower.endsWith(".ts") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".js") ||
    lower.endsWith(".jsx")
  ) {
    return true;
  }
  if (
    lower.endsWith(".py") ||
    lower.endsWith(".go") ||
    lower.endsWith(".rs") ||
    lower.endsWith(".java")
  ) {
    return true;
  }
  if (
    lower.includes("src/") ||
    lower.includes("services/") ||
    lower.includes("apps/") ||
    lower.includes("packages/")
  ) {
    return true;
  }
  if (lower.includes("/service") || lower.includes("-service")) {
    return true;
  }
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
          normalizedKey.includes("directory")
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

const isContainerOnlyService = (raw: any): boolean => {
  const metadata = raw?.metadata ?? {};
  return Boolean(
    metadata?.image ||
      metadata?.containerImage ||
      metadata?.compose ||
      metadata?.dockerfile ||
      metadata?.helmChart ||
      metadata?.chart,
  );
};

const ServiceCard: React.FC<{
  service: NormalizedService;
  onAddEndpoint: (service: NormalizedService) => void;
  onEditEndpoint: (service: NormalizedService, endpoint: NormalizedEndpointCard) => void;
}> = ({ service, onAddEndpoint, onEditEndpoint }) => {
  const [expanded, setExpanded] = useState(true);
  const hasDistinctName = Boolean(
    service.displayName && service.displayName.toLowerCase() !== service.identifier.toLowerCase(),
  );

  const handleToggle = () => setExpanded((prev) => !prev);
  const handleAddEndpoint = () => {
    onAddEndpoint(service);
  };

  return (
    <div className={clsx(ARTIFACT_PANEL_CLASS, "overflow-hidden font-medium")}>
      <div className="border-b border-white/40 px-3 py-2 dark:border-graphite-700/60">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-1.5 text-left transition-colors font-semibold"
        >
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                "flex h-10 w-10 items-center justify-center rounded-lg shadow-sm",
                service.typeLabel
                  ? (TYPE_BADGE_STYLES[service.typeLabel.toLowerCase()] ??
                      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200")
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
              )}
            >
              <Server className="h-4 w-4" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {service.displayName || service.identifier}
            </h3>
            {hasDistinctName && (
              <span className="font-mono text-xs lowercase text-gray-400 dark:text-graphite-400">
                {service.identifier}
              </span>
            )}
          </div>
          <ChevronUp
            className={clsx(
              "h-4 w-4 text-gray-500 transition-transform dark:text-graphite-300",
              expanded ? "rotate-180" : "rotate-0",
            )}
          />
        </button>
        <div
          className={clsx(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            expanded ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0 pointer-events-none",
          )}
          aria-hidden={!expanded}
        >
          <div className="mt-3 flex flex-wrap items-start justify-around gap-4">
            {service.description ? (
              <p className="text-sm leading-relaxed text-gray-600/70 dark:text-graphite-200/70 max-w-prose flex-1 basis-full md:basis-[55%] font-medium">
                {service.description}
              </p>
            ) : null}
            <div className="flex flex-1 min-w-[220px] flex-wrap justify-around gap-4 font-medium text-sm">
              {service.metadataItems.length > 0 &&
                service.metadataItems.map((item) => (
                  <div
                    key={`${service.key}-${item.label}`}
                    className="flex items-baseline gap-1 text-gray-700/80 dark:text-graphite-200/80"
                  >
                    <span className="uppercase tracking-wide text-[11px] font-medium text-gray-500/80 dark:text-graphite-300/80">
                      {item.label}:
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {item.value}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className={clsx(
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
          expanded ? "max-h-[720px] opacity-100" : "max-h-0 opacity-0 pointer-events-none",
        )}
        aria-hidden={!expanded}
      >
        <div className={clsx(ARTIFACT_PANEL_BODY_CLASS, "px-3 py-3 md:px-4 md:py-4 font-medium")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900/70 dark:text-graphite-50/70">
              <span className="pl-7">Endpoints</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500/70 dark:text-graphite-300/70">
                {service.endpoints.length}{" "}
                {service.endpoints.length === 1 ? "endpoint" : "endpoints"}
              </span>
              <button
                type="button"
                onClick={handleAddEndpoint}
                className="inline-flex items-center gap-1 text-xs lowercase text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold"
              >
                <Plus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Add endpoint</span>
              </button>
            </div>
          </div>

          {service.endpoints.length > 0 ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {service.endpoints.map((endpoint) => (
                <ArtifactCard
                  key={endpoint.key}
                  name={endpoint.name}
                  data={endpoint.data}
                  onClick={() => onEditEndpoint(service, endpoint)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-center text-gray-500 dark:text-graphite-300">
              No endpoints detected for this service.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const collectPorts = (raw: any): string => {
  const ports: string[] = [];
  const candidateSources = [
    raw?.ports,
    raw?.metadata?.ports,
    raw?.metadata?.exposedPorts,
    raw?.metadata?.containerPorts,
  ];

  candidateSources.forEach((source) => {
    if (!source) return;
    if (Array.isArray(source)) {
      source.forEach((entry) => {
        if (entry == null) return;
        if (typeof entry === "number" || typeof entry === "string") {
          const value = String(entry).trim();
          if (value) ports.push(value);
          return;
        }
        if (typeof entry === "object") {
          const host = entry.hostPort ?? entry.host ?? entry.external;
          const container = entry.containerPort ?? entry.port ?? entry.internal;
          if (host && container) {
            ports.push(`${host}:${container}`);
          } else if (container) {
            ports.push(String(container));
          }
        }
      });
    } else if (typeof source === "object") {
      Object.entries(source).forEach(([key, value]) => {
        const trimmedKey = String(key).trim();
        if (trimmedKey) {
          ports.push(trimmedKey);
        }
        if (value && typeof value === "string") {
          const trimmedValue = value.trim();
          if (trimmedValue) {
            ports.push(trimmedValue);
          }
        }
      });
    }
  });

  return Array.from(new Set(ports)).join(", ");
};

const extractTypeLabel = (raw: any): string | undefined => {
  const metadataType = raw?.metadata?.type;
  if (typeof metadataType === "string" && metadataType.trim()) {
    return metadataType.trim().replace(/_/g, " ");
  }
  const type = raw?.type;
  if (typeof type === "string" && type.trim()) {
    return type.trim().replace(/_/g, " ");
  }
  return undefined;
};

const normalizeEndpoints = (raw: any, serviceKey: string): NormalizedEndpointCard[] => {
  const endpoints: NormalizedEndpointCard[] = [];
  const seen = new Set<string>();

  const registerEndpoint = (endpoint: { method?: string; path?: string; description?: string }) => {
    const method = typeof endpoint.method === "string" ? endpoint.method.toUpperCase() : undefined;
    const path =
      typeof endpoint.path === "string" && endpoint.path.length > 0 ? endpoint.path : undefined;
    const description =
      typeof endpoint.description === "string" && endpoint.description.length > 0
        ? endpoint.description
        : undefined;
    const label = method && path ? `${method} ${path}` : path ? path : method ? method : "Endpoint";
    const key = `${method ?? "any"}|${path ?? label}`.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    const cardData = {
      name: label,
      description,
      metadata: {
        type: "route",
        httpMethods: method ? [method] : undefined,
        routePath: path,
        description,
      },
      path,
      httpMethods: method ? [method] : undefined,
    } as Record<string, unknown>;

    const candidateArtifactIds: Array<unknown> = [
      (endpoint as Record<string, unknown>)?.artifactId,
      (endpoint as Record<string, unknown>)?.artifact_id,
      (endpoint as Record<string, unknown>)?.id,
      (endpoint as Record<string, unknown>)?.entityId,
      (endpoint as Record<string, unknown>)?.entity_id,
      ((endpoint as Record<string, unknown>)?.metadata as Record<string, unknown> | undefined)
        ?.artifactId,
      ((endpoint as Record<string, unknown>)?.metadata as Record<string, unknown> | undefined)
        ?.artifact_id,
    ];
    const artifactId = candidateArtifactIds.find((value) => typeof value === "string") as
      | string
      | undefined;
    if (artifactId) {
      cardData.artifactId = artifactId;
      (cardData.metadata as Record<string, unknown>).artifactId = artifactId;
    }

    endpoints.push({
      key: `${serviceKey}-endpoint-${endpoints.length + 1}`,
      name: label,
      data: cardData,
    });
  };

  const parseEndpointEntry = (entry: any) => {
    if (!entry) return;
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (!trimmed) return;
      registerEndpoint({ path: trimmed });
      return;
    }
    if (typeof entry === "object") {
      const method = entry.method ?? entry.httpMethod ?? entry.verb ?? entry.type;
      const path = entry.path ?? entry.route ?? entry.url ?? entry.pattern;
      const description = entry.description ?? entry.summary ?? entry.docs;
      registerEndpoint({
        ...(typeof method === "string" && method.trim() ? { method: method.trim() } : {}),
        ...(typeof path === "string" && path.trim() ? { path: path.trim() } : {}),
        ...(typeof description === "string" && description.trim()
          ? { description: description.trim() }
          : {}),
      });
    }
  };

  const endpointSources = [
    raw?.endpoints,
    raw?.routes,
    raw?.metadata?.endpoints,
    raw?.metadata?.routes,
  ];
  endpointSources.forEach((source) => {
    if (!source) return;
    if (Array.isArray(source)) {
      source.forEach((entry) => parseEndpointEntry(entry));
    } else if (typeof source === "object") {
      Object.values(source).forEach((entry) => parseEndpointEntry(entry));
    }
  });

  const openApiPaths = raw?.openapi?.paths ?? raw?.openApi?.paths ?? raw?.metadata?.openapi?.paths;
  if (openApiPaths && typeof openApiPaths === "object") {
    Object.entries(openApiPaths).forEach(([pathKey, methods]) => {
      if (!methods || typeof methods !== "object") return;
      Object.entries(methods as Record<string, any>).forEach(([methodKey, config]) => {
        if (!methodKey) return;
        const description = config?.summary ?? config?.description;
        registerEndpoint({
          ...(typeof methodKey === "string" && methodKey.trim()
            ? { method: methodKey.trim() }
            : {}),
          ...(typeof pathKey === "string" && pathKey.trim() ? { path: pathKey.trim() } : {}),
          ...(typeof description === "string" && description.trim()
            ? { description: description.trim() }
            : {}),
        });
      });
    });
  }

  if (endpoints.length === 0 && raw?.metadata?.httpMethods && raw?.metadata?.routePath) {
    const methods = Array.isArray(raw.metadata.httpMethods)
      ? raw.metadata.httpMethods
      : [raw.metadata.httpMethods];
    for (const method of methods) {
      if (typeof method !== "string") continue;
      const trimmedMethod = method.trim();
      if (!trimmedMethod) continue;

      const routePath =
        typeof raw.metadata.routePath === "string" && raw.metadata.routePath.trim().length > 0
          ? raw.metadata.routePath.trim()
          : undefined;

      registerEndpoint({
        method: trimmedMethod,
        ...(routePath ? { path: routePath } : {}),
      });
    }
  }

  return endpoints;
};

const normalizeService = (key: string, raw: any): NormalizedService => {
  const identifier = key.trim() || raw?.id || raw?.slug || raw?.name || "service";
  const displayName =
    (typeof raw?.name === "string" && raw.name.trim()) ||
    (typeof raw?.title === "string" && raw.title.trim()) ||
    identifier;
  const description =
    (typeof raw?.description === "string" && raw.description.trim()) ||
    (typeof raw?.metadata?.description === "string" && raw.metadata.description.trim()) ||
    undefined;

  const language =
    (typeof raw?.language === "string" && raw.language.trim()) ||
    (typeof raw?.metadata?.language === "string" && raw.metadata.language.trim()) ||
    undefined;
  const framework =
    (typeof raw?.technology === "string" && raw.technology.trim()) ||
    (typeof raw?.framework === "string" && raw.framework.trim()) ||
    (typeof raw?.metadata?.framework === "string" && raw.metadata.framework.trim()) ||
    undefined;

  const { path: sourcePathCandidate, hasSource } = resolveSourcePath(raw);
  const containerOnly = isContainerOnlyService(raw);
  const sourcePath = hasSource && !containerOnly ? sourcePathCandidate : undefined;

  const ports = collectPorts(raw);
  const envCount = (() => {
    const envSources = [raw?.environment, raw?.metadata?.environment];
    for (const source of envSources) {
      if (source && typeof source === "object") {
        return Object.keys(source).length;
      }
    }
    return 0;
  })();

  const metadataItems: ServiceMetadataItem[] = [];
  if (language) {
    metadataItems.push({ label: "Language", value: language, icon: Languages });
  }
  if (framework) {
    metadataItems.push({ label: "Technology", value: framework, icon: Workflow });
  }
  if (sourcePath) {
    metadataItems.push({ label: "Source", value: sourcePath, icon: Folder });
  }
  if (ports) {
    metadataItems.push({ label: "Ports", value: ports, icon: Network });
  }
  if (envCount > 0) {
    metadataItems.push({ label: "Env Vars", value: String(envCount), icon: Boxes });
  }

  const endpoints = normalizeEndpoints(raw, identifier);
  const typeLabel = extractTypeLabel(raw);

  return {
    key: identifier,
    identifier,
    displayName,
    description,
    metadataItems,
    endpoints,
    hasSource: Boolean(sourcePath),
    ...(typeLabel ? { typeLabel } : {}),
    raw: raw ?? null,
    ...(sourcePath ? { sourcePath } : {}),
  };
};

const createExternalArtifactCard = (key: string, raw: any): ExternalArtifactCard => {
  const displayName =
    (typeof raw?.name === "string" && raw.name.trim()) ||
    (typeof raw?.metadata?.displayName === "string" && raw.metadata.displayName.trim()) ||
    key;
  const description =
    (typeof raw?.description === "string" && raw.description.trim()) ||
    (typeof raw?.metadata?.description === "string" && raw.metadata.description.trim()) ||
    undefined;
  const language =
    (typeof raw?.language === "string" && raw.language.trim()) ||
    (typeof raw?.metadata?.language === "string" && raw.metadata.language.trim()) ||
    undefined;
  const framework =
    (typeof raw?.technology === "string" && raw.technology.trim()) ||
    (typeof raw?.framework === "string" && raw.framework.trim()) ||
    (typeof raw?.metadata?.framework === "string" && raw.metadata.framework.trim()) ||
    (typeof raw?.image === "string" && raw.image.trim()) ||
    undefined;
  const routePath = collectPorts(raw) || raw?.metadata?.routePath || raw?.path;

  const data: Record<string, unknown> = {
    name: displayName,
    description,
    language,
    metadata: {
      ...(raw?.metadata ?? {}),
      type: raw?.metadata?.type ?? raw?.type ?? "external-service",
      language,
      framework,
      routePath,
    },
    path: routePath,
    framework,
  };

  if (raw?.image) {
    data.metadata = {
      ...(data.metadata as Record<string, unknown>),
      framework: framework ?? raw.image,
    };
  }

  return {
    key,
    name: displayName,
    data,
  };
};

const normalizeContainersAsExternalCards = (
  containers: any[] | undefined,
  knownIdentifiers: Set<string>,
): ExternalArtifactCard[] => {
  if (!Array.isArray(containers)) {
    return [];
  }
  const cards: ExternalArtifactCard[] = [];
  containers.forEach((container, index) => {
    if (!container) return;
    const scope = typeof container.scope === "string" ? container.scope.toLowerCase() : "";
    const shouldInclude = ["service", "job", "worker", "external"].includes(scope);
    if (!shouldInclude) return;
    const name =
      (typeof container.name === "string" && container.name.trim()) ||
      (typeof container.id === "string" && container.id.trim()) ||
      `container-${index + 1}`;
    if (knownIdentifiers.has(name)) {
      return;
    }
    const data: Record<string, unknown> = {
      name,
      description:
        (typeof container.description === "string" && container.description.trim()) ||
        `Container image ${container.image ?? "unknown"}`,
      metadata: {
        type: "external-service",
        framework: (typeof container.image === "string" && container.image.trim()) ?? undefined,
        routePath: collectPorts(container),
      },
      path: collectPorts(container),
      framework: container.image,
    };

    cards.push({ key: `container-${name}`, name, data });
  });
  return cards;
};

export const ServicesReport: React.FC<ServicesReportProps> = ({ projectId, className }) => {
  const { data, isLoading, isError, error } = useResolvedSpec(projectId);
  const queryClient = useQueryClient();
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [uiOptionCatalog, setUiOptionCatalog] =
    useState<UiOptionCatalog>(DEFAULT_UI_OPTION_CATALOG);
  const [addEndpointState, setAddEndpointState] = useState<{
    open: boolean;
    service: NormalizedService | null;
  }>({ open: false, service: null });
  const [editEndpointState, setEditEndpointState] = useState<{
    open: boolean;
    service: NormalizedService | null;
    endpoint: NormalizedEndpointCard | null;
  }>({ open: false, service: null, endpoint: null });

  const refreshResolved = useCallback(
    async (_options: { silent?: boolean } = {}) => {
      if (!projectId) return;
      await queryClient.invalidateQueries({ queryKey: ["resolved-spec", projectId] });
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const catalog = await apiService.getUiOptionCatalog();
        if (!mounted) return;
        setUiOptionCatalog((prev) => ({ ...DEFAULT_UI_OPTION_CATALOG, ...prev, ...catalog }));
      } catch (catalogError) {
        console.warn("[ServicesReport] Failed to load UI option catalog", catalogError);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

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

    normalizedServices.forEach((service) => {
      if (service.hasSource) {
        internal.push(service);
      } else {
        external.push(createExternalArtifactCard(service.identifier, service.raw));
      }
    });

    const knownIdentifiers = new Set<string>([
      ...normalizedServices.map((service) => service.identifier),
      ...external.map((card) => card.key),
    ]);

    const containerCards = normalizeContainersAsExternalCards(containers, knownIdentifiers);
    containerCards.forEach((card) => external.push(card));

    const dedupedExternal = Array.from(
      external.reduce((acc, card) => {
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
    <div className={clsx("h-full", className)}>
      <div className="flex h-full flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-gray-600 dark:text-graphite-300">
            Loading services...
          </div>
        ) : isError ? (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-rose-600 dark:text-rose-400">
            {error instanceof Error ? error.message : "Unable to load services for this project."}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <div className="border-b border-gray-200 bg-white px-6 py-6 dark:border-graphite-800 dark:bg-graphite-900">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25">
                    Catalog
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-graphite-300">
                    Manage detected application services and external runtimes powering this
                    project.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddService}
                  disabled={!projectId || isCreatingService}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors",
                    "hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:bg-blue-400 disabled:text-blue-100",
                  )}
                >
                  <Plus className="h-4 w-4" />
                  Add Service
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                {internalServices.length > 0 ? (
                  internalServices.map((service) => (
                    <ServiceCard
                      key={service.key}
                      service={service}
                      onAddEndpoint={handleOpenAddEndpointModal}
                      onEditEndpoint={handleOpenEditEndpointModal}
                    />
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-graphite-300">
                    No code-backed services detected yet. Use the Add Service button to document new
                    services or ingest additional repositories.
                  </p>
                )}

                {externalCards.length > 0 ? (
                  <div className={clsx(ARTIFACT_PANEL_CLASS, "overflow-hidden font-medium")}>
                    <div className="border-b border-white/40 px-4 py-3 dark:border-graphite-700/60">
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
                    <div className={clsx(ARTIFACT_PANEL_BODY_CLASS, "px-3 py-3 md:px-4 md:py-4")}>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {externalCards.map((card) => (
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

export default ServicesReport;
