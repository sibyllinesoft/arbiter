/**
 * Client data transformers for normalizing CUE assembly client specifications.
 * Transforms raw client data into structured views for the ClientsReport component.
 */
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

type RawData = Record<string, unknown>;

function isApiRoute(path: string): boolean {
  return path === "/api" || path.startsWith("/api/");
}

function normalizePath(rawPath: string): string {
  const trimmed = rawPath.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function extractPathLabel(normalizedPath: string, candidateBasePath: string | undefined): string {
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
  return pathSegments[pathSegments.length - 1] || pathLabelSource || normalizedPath;
}

function extractBasePath(route: RawData, router: RawData): string | undefined {
  const metadataBasePath = coerceDisplayValue(
    (route?.metadata as RawData)?.basePath ??
      (route?.metadata as RawData)?.base_path ??
      (route?.metadata as RawData)?.mountPath ??
      (route?.metadata as RawData)?.mount_path ??
      (route?.metadata as RawData)?.pathPrefix ??
      (route?.metadata as RawData)?.path_prefix,
  );
  const routerBasePath = coerceDisplayValue(
    router?.basePath ?? router?.pathPrefix ?? router?.prefix,
  );
  return metadataBasePath || routerBasePath;
}

function createViewFromRoute(
  route: RawData,
  router: RawData,
  index: number,
): NormalizedClientView | null {
  const rawPath = typeof route?.path === "string" ? route.path : "";
  const trimmedPath = rawPath.trim();
  if (!trimmedPath) return null;

  const normalizedPath = normalizePath(trimmedPath);
  if (isApiRoute(normalizedPath)) return null;

  const routerType = coerceDisplayValue(router?.type) ?? coerceDisplayValue(router?.name);
  const key = `${normalizedPath}@${routerType ?? "router"}@${index}`;

  const componentId = coerceDisplayValue(route?.component);
  const moduleId = coerceDisplayValue(
    (route?.metadata as RawData)?.module ?? (route?.metadata as RawData)?.component,
  );
  const candidateBasePath = extractBasePath(route, router);
  const pathLabel = extractPathLabel(normalizedPath, candidateBasePath);
  const label = componentId || moduleId || pathLabel || `view-${index + 1}`;
  const filePath = coerceDisplayValue(route?.filePath);

  return {
    key,
    path: normalizedPath,
    component: label,
    ...(routerType && { routerType }),
    ...(filePath && { filePath }),
  };
}

/** Extract client views from frontend analysis router data */
export const extractClientViews = (raw: RawData): NormalizedClientView[] => {
  const analysis = (raw?.metadata as RawData)?.frontendAnalysis as RawData | undefined;
  if (!analysis) return [];

  const routeMap = new Map<string, NormalizedClientView>();
  const routers = Array.isArray(analysis.routers) ? analysis.routers : [];

  for (const router of routers) {
    const routes = Array.isArray(router?.routes) ? router.routes : [];
    for (const [index, route] of routes.entries()) {
      const view = createViewFromRoute(route, router, index);
      if (view && !routeMap.has(view.key)) {
        routeMap.set(view.key, view);
      }
    }
  }

  return Array.from(routeMap.values()).sort((a, b) => a.path.localeCompare(b.path));
};

/** Check if a client was manually created by the user */
export const isManualClient = (client: NormalizedClient): boolean => {
  const classification = client.raw?.metadata?.classification as RawData | undefined;
  if (!classification) return false;
  return classification.source === "user" || classification.reason === "manual-entry";
};

/** Create an external artifact card from raw client data */
export const createExternalArtifactCard = (
  identifier: string,
  raw: RawData,
): ExternalArtifactCard => {
  const metadata = raw?.metadata as RawData;
  const description =
    coerceDisplayValue(raw?.description) ??
    coerceDisplayValue(metadata?.description) ??
    coerceDisplayValue(metadata?.summary);
  const name = coerceDisplayValue(raw?.name) ?? identifier;

  const card: ExternalArtifactCard = {
    key: `external-${identifier}`,
    name,
    data: { name, metadata: metadata ?? {} },
  };

  if (description) {
    card.description = description;
    card.data.description = description;
  }

  return card;
};

function buildMetadataItems(
  language: string | undefined,
  framework: string | undefined,
  frameworks: string[],
  typeLabel: string | undefined,
  sourcePath: string | undefined,
  componentsCount: number,
  viewsCount: number,
): ClientMetadataItem[] {
  const items: ClientMetadataItem[] = [];

  if (language) items.push({ label: "Language", value: language });

  if (frameworks.length > 0) {
    items.push({ label: "Frameworks", value: frameworks.join(", ") });
  } else if (framework) {
    items.push({ label: "Framework", value: framework });
  }

  if (typeLabel) {
    items.push({ label: "Type", value: typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1) });
  }

  if (sourcePath) items.push({ label: "Source", value: sourcePath });
  if (componentsCount > 0) items.push({ label: "Components", value: String(componentsCount) });
  items.push({ label: "Views", value: String(viewsCount) });

  return items;
}

function extractFrameworksAndComponents(raw: RawData): {
  frameworks: string[];
  components: unknown[];
} {
  const frontendAnalysis = (raw?.metadata as RawData)?.frontendAnalysis as RawData | undefined;
  const isValidString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

  const frameworks = Array.isArray(frontendAnalysis?.frameworks)
    ? (frontendAnalysis.frameworks as unknown[]).filter(isValidString)
    : Array.isArray(raw?.frameworks)
      ? (raw.frameworks as unknown[]).filter(isValidString)
      : [];

  const components = Array.isArray(frontendAnalysis?.components)
    ? (frontendAnalysis.components as unknown[])
    : Array.isArray(raw?.components)
      ? (raw.components as unknown[])
      : [];

  return { frameworks, components };
}

function combineViews(
  baseViews: NormalizedClientView[],
  manualViewMap: Map<string, NormalizedClientView[]>,
  candidateKeys: (string | undefined)[],
): NormalizedClientView[] {
  const combined: NormalizedClientView[] = [];
  const seenKeys = new Set<string>();

  const registerView = (view: NormalizedClientView) => {
    const key = `${view.path}|${view.component ?? ""}`.toLowerCase();
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    combined.push(view);
  };

  baseViews.forEach(registerView);

  for (const candidate of candidateKeys) {
    if (!candidate) continue;
    const normalizedKey = candidate.trim().toLowerCase();
    if (!normalizedKey) continue;
    const manualViews = manualViewMap.get(normalizedKey);
    manualViews?.forEach(registerView);
  }

  return combined;
}

/** Normalize raw client data into a structured NormalizedClient object */
export const normalizeClient = (
  key: string,
  raw: RawData,
  manualViewMap: Map<string, NormalizedClientView[]>,
): NormalizedClient => {
  const identifier = coerceDisplayValue(raw?.artifactId) ?? coerceDisplayValue(raw?.id) ?? key;
  const metadata = raw?.metadata as RawData | undefined;
  let displayName = coerceDisplayValue(raw?.name) ?? identifier;
  const description =
    coerceDisplayValue(raw?.description) ?? coerceDisplayValue(metadata?.description);

  const { path: sourcePath, hasSource } = resolveSourcePath(raw);
  const language = coerceDisplayValue(metadata?.language ?? raw?.language);
  const framework = coerceDisplayValue(metadata?.framework ?? raw?.framework);
  const typeLabelRaw = extractTypeLabel(raw);
  const typeLabel = typeLabelRaw
    ? typeLabelRaw.charAt(0).toUpperCase() + typeLabelRaw.slice(1)
    : undefined;

  // Fallback display name from file path
  const metaFilePath = typeof metadata?.filePath === "string" ? metadata.filePath : undefined;
  if (!displayName && metaFilePath) {
    const candidate = metaFilePath.split("/").pop()?.split(".")[0];
    if (candidate) displayName = candidate;
  }

  const { frameworks, components } = extractFrameworksAndComponents(raw);
  const baseViews = extractClientViews(raw);

  const candidateKeys = [
    identifier,
    slugify(identifier ?? ""),
    displayName,
    slugify(displayName ?? ""),
  ];
  const combinedViews = combineViews(baseViews, manualViewMap, candidateKeys);

  const metadataItems = buildMetadataItems(
    language,
    framework,
    frameworks,
    typeLabel,
    sourcePath,
    components.length,
    combinedViews.length,
  );

  return {
    key: identifier ?? key,
    identifier: identifier ?? key,
    displayName: displayName ?? identifier ?? key,
    metadataItems,
    views: combinedViews,
    hasSource,
    raw,
    ...(description && { description }),
    ...(sourcePath && { sourcePath }),
    ...(typeLabel && { typeLabel }),
    ...(language && { language }),
  };
};
