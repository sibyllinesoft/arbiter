import { type EnvironmentMap, mergeEnvironmentSources } from "@/utils/environment";
import { Boxes, Folder, Languages, Network, Workflow } from "lucide-react";
import type {
  ExternalArtifactCard,
  NormalizedEndpointCard,
  NormalizedService,
  ServiceMetadataItem,
} from "./types";
import { collectPorts, deriveArtifactIdFromRaw, resolveSourcePath } from "./utils";

export const buildEnvironmentMap = (raw: any): EnvironmentMap => {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  return mergeEnvironmentSources(
    raw.environment,
    raw.env,
    raw.config?.environment,
    raw.metadata?.environment,
    raw.metadata?.config?.environment,
  );
};

export const extractTypeLabel = (raw: any): string | undefined => {
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

export const normalizeEndpoints = (raw: any, serviceKey: string): NormalizedEndpointCard[] => {
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

export const normalizeService = (key: string, raw: any): NormalizedService => {
  const metadata =
    raw && typeof raw === "object" && raw.metadata && typeof raw.metadata === "object"
      ? (raw.metadata as Record<string, unknown>)
      : {};
  const identifier = key.trim() || raw?.id || raw?.slug || raw?.name || "service";
  const displayName =
    (typeof raw?.name === "string" && raw.name.trim()) ||
    (typeof raw?.title === "string" && raw.title.trim()) ||
    identifier;
  const description =
    (typeof raw?.description === "string" && raw.description.trim()) ||
    (typeof metadata.description === "string" && (metadata.description as string).trim()) ||
    undefined;

  const language =
    (typeof raw?.language === "string" && raw.language.trim()) ||
    (typeof metadata.language === "string" && (metadata.language as string).trim()) ||
    undefined;
  const framework =
    (typeof raw?.technology === "string" && raw.technology.trim()) ||
    (typeof raw?.framework === "string" && raw.framework.trim()) ||
    (typeof metadata.framework === "string" && (metadata.framework as string).trim()) ||
    undefined;

  const { path: sourcePathCandidate, hasSource: hasActualSource } = resolveSourcePath(raw);
  const sourcePath = sourcePathCandidate;

  const ports = collectPorts(raw);
  const environmentMap = buildEnvironmentMap(raw);
  const envCount = Object.keys(environmentMap).length;

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
  const artifactId = deriveArtifactIdFromRaw(raw);
  const environment = envCount > 0 ? environmentMap : undefined;

  return {
    key: identifier,
    identifier,
    displayName,
    description,
    metadataItems,
    endpoints,
    hasSource: hasActualSource,
    ...(typeLabel ? { typeLabel } : {}),
    raw: raw ?? null,
    artifactId: artifactId ?? null,
    ...(sourcePath ? { sourcePath } : {}),
    ...(environment ? { environment } : {}),
  };
};

export const createExternalArtifactCard = (key: string, raw: any): ExternalArtifactCard => {
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

export const normalizeContainersAsExternalCards = (
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
