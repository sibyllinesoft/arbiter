import type {
  ClientMetadataItem,
  ExternalArtifactCard,
  NormalizedClient,
  NormalizedClientView,
} from "@/components/ClientsReport/types";
import {
  coerceDisplayValue,
  extractTypeLabel,
  resolveSourcePath,
  slugify,
} from "@/features/spec/utils/clients";

export const extractClientViews = (raw: any): NormalizedClientView[] => {
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

export const isManualClient = (client: NormalizedClient): boolean => {
  const classification = client.raw?.metadata?.classification;
  if (!classification || typeof classification !== "object") {
    return false;
  }
  const source = (classification as Record<string, unknown>).source;
  const reason = (classification as Record<string, unknown>).reason;
  return source === "user" || reason === "manual-entry";
};

export const createExternalArtifactCard = (identifier: string, raw: any): ExternalArtifactCard => {
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

export const normalizeClient = (
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

  // Extract frontend analysis data
  const frontendAnalysis = raw?.metadata?.frontendAnalysis;
  const frameworks = Array.isArray(frontendAnalysis?.frameworks)
    ? frontendAnalysis.frameworks.filter((f: unknown) => typeof f === "string" && f.trim())
    : Array.isArray(raw?.frameworks)
      ? raw.frameworks.filter((f: unknown) => typeof f === "string" && f.trim())
      : [];
  const components = Array.isArray(frontendAnalysis?.components)
    ? frontendAnalysis.components
    : Array.isArray(raw?.components)
      ? raw.components
      : [];

  const metadataItems: ClientMetadataItem[] = [];
  if (language) {
    metadataItems.push({ label: "Language", value: language });
  }
  // Show all frameworks if available, otherwise fall back to single framework
  if (frameworks.length > 0) {
    metadataItems.push({ label: "Frameworks", value: frameworks.join(", ") });
  } else if (framework) {
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
  // Show components count if available
  if (components.length > 0) {
    metadataItems.push({ label: "Components", value: String(components.length) });
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
